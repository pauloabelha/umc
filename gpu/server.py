"""Loopback HTTP bridge. Each tab owns a leased CUDA world; no CPU fallback."""
import gc
import json
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from physics import World

PORT = 8792
ORIGINS = {f'http://{host}:{port}' for host in ('localhost', '127.0.0.1') for port in (5173, 4173)}


class Service:
    def __init__(self):
        self.worlds = {}

    def expire(self):
        for key, (_, touched) in list(self.worlds.items()):
            if time.monotonic() - touched > 120:
                del self.worlds[key]
        gc.collect()

    def handle(self, method, path, data):
        if method == 'GET' and path == ['health']:
            import warp as wp
            device = wp.get_device('cuda:0')
            return dict(format='umc-gpu', cuda=bool(device.is_cuda), device=device.name)
        if method == 'POST' and path == ['worlds']:
            if len(self.worlds) >= 4:
                raise ValueError('Close an existing simulator before creating another world')
            world = World(data['scene'])
            key = str(uuid.uuid4())
            self.worlds[key] = (world, time.monotonic())
            return dict(id=key, ticks=0, snapshot=world.snapshot())
        if len(path) < 2 or path[0] != 'worlds':
            raise KeyError('Unknown route')
        key = path[1]
        if method == 'DELETE' and len(path) == 2:
            self.worlds.pop(key, None)
            return dict(closed=key)
        world, _ = self.worlds[key]
        self.worlds[key] = (world, time.monotonic())
        if method == 'POST' and path[2:] == ['lease']:
            return dict(renewed=key)
        if method == 'POST' and path[2:] == ['release']:
            if type(data.get('expectedTicks')) is not int or data['expectedTicks']!=world.ticks: raise ValueError('Stale world time')
            return dict(ticks=world.ticks,snapshot=world.release_marble(data.get('id'),data.get('position'),data.get('velocity')))
        if method == 'POST' and path[2:] == ['step']:
            steps = data.get('steps')
            if type(steps) is not int or not 1 <= steps <= 16:
                raise ValueError('Expected 1–16 steps')
            if type(data.get('expectedTicks')) is not int or data['expectedTicks'] != world.ticks:
                raise ValueError('Stale world time; reset before continuing')
            stride=data.get('sampleEvery',1)
            if type(stride) is not int or stride<1 or steps%stride: raise ValueError('Invalid observation stride')
            samples=[]
            for i in range(steps):
                sample=world.step(observe=(i+1)%stride==0)
                if sample is not None: samples.append(sample)
            return dict(ticks=world.ticks, samples=samples)
        raise KeyError('Unknown route')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def reply(self, status, payload):
        raw = json.dumps(payload, allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        if self.headers.get('Origin') in ORIGINS:
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-UMC-Bridge')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
        self.wfile.write(raw)

    def dispatch(self):
        try:
            if self.headers.get('Host') not in {f'localhost:{PORT}', f'127.0.0.1:{PORT}'} or self.headers.get('Origin') not in ORIGINS | {None}:
                self.reply(403, dict(error='Untrusted origin')); return
            if self.command == 'OPTIONS':
                self.reply(200, dict(ok=True)); return
            if self.command in ('POST', 'DELETE') and self.headers.get('X-UMC-Bridge') != '1':
                self.reply(403, dict(error='Missing bridge header')); return
            data = {}
            if self.command == 'POST':
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 2097152:
                    raise ValueError('Invalid request size')
                data = json.loads(self.rfile.read(size))
                if not isinstance(data, dict):
                    raise ValueError('Expected JSON object')
            result = self.server.service.handle(self.command, self.path.strip('/').split('/'), data)
            self.reply(200, result)
        except (ValueError, TypeError) as error:
            self.reply(400, dict(error=str(error)))
        except KeyError as error:
            self.reply(404, dict(error=str(error)))
        except Exception as error:
            self.reply(500, dict(error=str(error)))

    do_GET = do_POST = do_DELETE = do_OPTIONS = dispatch


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    server.service = Service()
    server.timeout = 1
    print(f'UMC GPU service: http://127.0.0.1:{PORT}', flush=True)
    last_cleanup = time.monotonic()
    try:
        while True:
            server.handle_request()
            if time.monotonic() - last_cleanup > 30:
                server.service.expire()
                last_cleanup = time.monotonic()
    except KeyboardInterrupt:
        server.server_close()

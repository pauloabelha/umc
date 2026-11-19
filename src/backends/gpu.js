// Transport only: no semantic answers and no CPU fallback.
export function gpuClient({baseUrl = 'http://127.0.0.1:8792', fetchImpl = globalThis.fetch} = {}) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(base.hostname) ||
      base.pathname !== '/' || base.username || base.password || base.search || base.hash) throw new Error('GPU service must be a loopback origin');
  async function request(path, method = 'GET', payload) {
    const response = await fetchImpl(new URL(path, base), {method,
      headers: {'X-UMC-Bridge': '1', ...(payload ? {'Content-Type': 'application/json'} : {})},
      ...(payload ? {body: JSON.stringify(payload)} : {}),
      signal: AbortSignal.timeout(60000), keepalive: method === 'DELETE'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `GPU request failed: ${response.status}`);
    return data;
  }
  return {
    async health() {
      const info = await request('health');
      if (info.format !== 'umc-gpu' || !info.cuda) throw new Error('UMC CUDA service unavailable');
      return info;
    },
    async create(scene) {
      if (scene.physicalSupported === false) throw new Error('Physical mechanism not implemented for this lattice prototype');
      const collisionScene={...scene,bodies:scene.bodies?.map(({collisionShape,...body})=>({...body,shape:collisionShape??body.shape}))};
      const created = await request('worlds', 'POST', {scene:collisionScene});
      let ticks = created.ticks, closed = false, busy = false;
      const path = `worlds/${encodeURIComponent(created.id)}`;
      const lease = setInterval(() => request(`${path}/lease`, 'POST', {}).catch(() => {}), 30000);
      lease.unref?.();
      return {
        initial: created.snapshot,
        async releaseMarble(id,position,velocity=[0,0,0]) {
          if(closed||busy)throw new Error('GPU world is closed or busy');
          busy=true;
          try{return (await request(`${path}/release`,'POST',{id,position,velocity,expectedTicks:ticks})).snapshot;}
          catch(error){closed=true;clearInterval(lease);throw error;}
          finally{busy=false;}
        },
        async advance(steps = 4, {sampleEvery = 1} = {}) {
          if (closed || busy) throw new Error('GPU world is closed or busy');
          busy = true;
          try {
            const result = await request(`${path}/step`, 'POST', {steps, sampleEvery, expectedTicks: ticks});
            ticks = result.ticks;
            return result.samples;
          } catch (error) {
            // An uncertain step must never be retried on this world.
            closed = true; clearInterval(lease);
            throw error;
          } finally {busy = false;}
        },
        async dispose() {
          closed = true; clearInterval(lease);
          await request(path, 'DELETE');
        },
      };
    },
  };
}

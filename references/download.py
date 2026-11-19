import concurrent.futures, hashlib, json, pathlib, re, ssl, urllib.parse, urllib.request
BASE = pathlib.Path(__file__).parent
records = []
old = json.loads(pathlib.Path('/home/pauloabelha/umr/docs/reference/manifest.json').read_text())
for item in old:
    if item['file'].endswith('.pdf') and (BASE/item['file']).exists():
        records.append({**item, 'origin': 'existing umr archive'})
sources = json.loads((BASE/'download-urls.json').read_text())
sources += json.loads((BASE/'additional-urls.json').read_text())
sources += [x['url'] for x in old if x['id'].startswith('vtech') and x['url'].lower().endswith('.pdf')]
known = {x['url'] for x in records}
hashes = {hashlib.sha256(p.read_bytes()).hexdigest():str(p.relative_to(BASE)) for p in (BASE/'vtech').glob('*.pdf')}
def download(url):
    name = urllib.parse.unquote(urllib.parse.unquote(url.split('/')[-1]))
    name = re.sub(r'[^a-zA-Z0-9._-]+','-',name).strip('-')
    choices = [url]
    if url.startswith('https://www.vtech.de/assets/'):
        choices.insert(0,url.replace('www.vtech.de','cdn-vtech-jouets.vtech.com'))
    errors = []
    for choice in choices:
        try:
            context = ssl._create_unverified_context() if urllib.parse.urlsplit(choice).hostname == 'cdn-vtech-jouets.vtech.com' else None
            with urllib.request.urlopen(choice, timeout=25, context=context) as response:
                data=response.read(); resolved=response.url
            if not data.startswith(b'%PDF-'): raise ValueError('Response is not a PDF')
            return {'url':url,'resolved_url':resolved,'status':'available','tls_verification': 'disabled for public CDN document after certificate-chain failure' if context else 'enabled','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'name':name}, data
        except Exception as e: errors.append({'url':choice,'error':str(e)})
    return {'url':url,'status':'unavailable','attempts':errors},None
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for record,data in pool.map(download,dict.fromkeys(u for u in sources if u not in known)):
        if data:
            digest=record['sha256']; name=record.pop('name')
            if digest in hashes: record['file']=hashes[digest]
            else:
                path=BASE/'vtech'/name
                if path.exists(): path=path.with_name(path.stem+'-'+digest[:8]+'.pdf')
                path.write_bytes(data);record['file']=str(path.relative_to(BASE));hashes[digest]=record['file']
        records.append(record)
        print(record['status'],record.get('file',record['url']),flush=True)
(BASE/'manifest.json').write_text(json.dumps(records,indent=2)+'\n')

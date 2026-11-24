// Scoped owner maintenance: inspect/repair only this ship's Harness image ACLs.
// SHIP_COOKIE is a Netscape cookie file; credentials stay in memory, never logs.
// Dry run by default. --apply repairs owner-only ACLs, not bucket permissions.
// --verify-upload checks the presigned PUT wire shape with a temporary PNG.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash, createHmac, randomUUID } from 'node:crypto'

const apply = process.argv.includes('--apply'), verify = process.argv.includes('--verify-upload')
const base = process.env.SHIP_URL || 'http://127.0.0.1'
const row = (await readFile(process.env.SHIP_COOKIE, 'utf8')).split('\n').find(r => /\turbauth-~/.test(r))?.split('\t')
assert.ok(row, 'An authenticated ship cookie is required')
const cookie = `${row[5]}=${row[6]}`, ship = row[5].slice('urbauth-'.length)
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
const sha = data => createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()
const decode = text => text.replace(/&#x([0-9a-f]+);|&#([0-9]+);|&(amp|lt|gt|quot|apos);/gi, (_, hex, dec, name) => hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[name])
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1] || '')
async function scry(section) {
  const res = await fetch(`${base}/~/scry/storage/${section}.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
  assert.equal(res.status, 200, `Cannot read ship storage ${section}`)
  return (await res.json())['storage-update'][section]
}
const [credentials, configuration] = await Promise.all([scry('credentials'), scry('configuration')])
assert.equal(configuration.service, 'credentials', 'This maintenance operation is only for custom Spaces storage')
const endpoint = new URL(credentials.endpoint.includes('://') ? credentials.endpoint : `https://${credentials.endpoint}`)
assert.ok(endpoint.protocol === 'https:' && endpoint.hostname.endsWith('.digitaloceanspaces.com') && !endpoint.port && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && endpoint.pathname === '/', 'Expected a standard HTTPS Spaces endpoint')
const bucket = configuration.currentBucket, region = configuration.region || 'us-east-1'
assert.match(bucket, /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
assert.ok(credentials.accessKeyId && credentials.secretAccessKey)
const objectUrl = key => `${endpoint.origin}/${encode(bucket)}/${key.split('/').map(encode).join('/')}`
function signature(method, url, headers, payloadHash, date) {
  const day = date.slice(0, 8), scope = `${day}/${region}/s3/aws4_request`
  const names = Object.keys(headers).sort(), signed = names.join(';')
  const query = [...url.searchParams].map(([k,v]) => [encode(k), encode(v)]).sort(([a,av],[b,bv]) => a === b ? av.localeCompare(bv) : a < b ? -1 : 1).map(([k,v]) => `${k}=${v}`).join('&')
  const canonical = [method, url.pathname, query, names.map(name => `${name}:${headers[name].trim()}\n`).join(''), signed, payloadHash].join('\n')
  let key = Buffer.from(`AWS4${credentials.secretAccessKey}`)
  for (const part of [day, region, 's3', 'aws4_request']) key = hmac(key, part)
  const value = hmac(key, ['AWS4-HMAC-SHA256', date, scope, sha(canonical)].join('\n')).toString('hex')
  return { scope, signed, value }
}
async function request(method, key = '', query = {}, extra = {}) {
  const url = new URL(objectUrl(key))
  for (const [name,value] of Object.entries(query)) url.searchParams.set(name,value)
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const headers = { host: url.host, 'x-amz-date': date, 'x-amz-content-sha256': sha(''), ...extra }
  const sig = signature(method, url, headers, sha(''), date)
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${sig.scope}, SignedHeaders=${sig.signed}, Signature=${sig.value}`
  return fetch(url, { method, headers, redirect: 'error', signal: AbortSignal.timeout(30000) })
}
async function anonymousStatus(key) {
  const res = await fetch(objectUrl(key), { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000) })
  await res.body?.cancel()
  return res.status
}
async function main() {
  const listing = await request('GET', '', { 'list-type': '2', prefix: `${ship}/harness-`, 'max-keys': '1000' })
  assert.equal(listing.status, 200, 'Spaces object listing failed')
  const xml = await listing.text()
  assert.equal(tag(xml, 'IsTruncated'), 'false', 'Listing exceeds the safety limit; narrow scope before repair')
  const keys = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(match => tag(match[1], 'Key')).filter(key => key.startsWith(`${ship}/harness-`) && /^harness-0v[0-9a-v.]+\.(png|jpg|gif|webp)$/.test(key.slice(ship.length + 1)))
  let repaired = 0, publicCount = 0, eligible = 0, skipped = 0
  for (const key of keys) {
    const acl = await request('GET', key, { acl: '' })
    assert.equal(acl.status, 200, 'Cannot inspect object ACL')
    const policy = await acl.text(), grants = [...policy.matchAll(/<Grant>([\s\S]*?)<\/Grant>/g)].map(match => match[1])
    const alreadyPublic = grants.some(grant => tag(grant,'URI') === 'http://acs.amazonaws.com/groups/global/AllUsers' && tag(grant,'Permission') === 'READ')
    if (alreadyPublic) {
      assert.equal(await anonymousStatus(key), 200, 'An existing public ACL is not sufficient for anonymous reads')
      publicCount++; continue
    }
    const owner = tag(tag(policy, 'Owner'), 'ID')
    if (!owner || grants.length !== 1 || tag(grants[0], 'ID') !== owner || tag(grants[0], 'Permission') !== 'FULL_CONTROL') { skipped++; continue }
    const head = await request('HEAD', key)
    assert.equal(head.status, 200, 'Cannot inspect uploaded image metadata')
    if (!/^image\/(png|jpeg|gif|webp)$/.test(head.headers.get('content-type')) || Number(head.headers.get('content-length')) > 8388608) { skipped++; continue }
    eligible++
    if (!apply) continue
    const updated = await request('PUT', key, { acl: '' }, { 'x-amz-acl': 'public-read' })
    assert.equal(updated.status, 200, 'Object ACL update failed')
    await updated.body?.cancel()
    assert.equal(await anonymousStatus(key), 200, 'Repaired object is not anonymously readable')
    repaired++
  }
  console.log(JSON.stringify({ dryRun: !apply, matchingImages: keys.length, ownerOnlyImages: eligible, alreadyPublic: publicCount, skippedCustomOrNonImage: skipped, repaired }))
  if (verify) {
    // The exact signed header/query shape covered by the independent Hoon vector.
    const key = `${ship}/harness-acl-verification-${randomUUID()}.png`
    const data = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZfoAAAAASUVORK5CYII=', 'base64')
    const url = new URL(objectUrl(key)), date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
    const headers = { host: url.host, 'cache-control': 'public, max-age=3600', 'content-type': 'image/png', 'x-amz-acl': 'public-read' }
    const scope = `${date.slice(0,8)}/${region}/s3/aws4_request`
    for (const [name,value] of Object.entries({ 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${credentials.accessKeyId}/${scope}`, 'X-Amz-Date': date, 'X-Amz-Expires': '300', 'X-Amz-SignedHeaders': Object.keys(headers).sort().join(';'), 'x-amz-acl': 'public-read' })) url.searchParams.set(name,value)
    url.searchParams.set('X-Amz-Signature', signature('PUT',url,headers,'UNSIGNED-PAYLOAD',date).value)
    let accepted = false
    try {
      const res = await fetch(url, { method: 'PUT', headers, body: data, redirect: 'error', signal: AbortSignal.timeout(30000) })
      assert.equal(res.status,200,'Spaces rejected the corrected presigned upload')
      accepted = true; await res.body?.cancel()
      const publicRead = await fetch(objectUrl(key), { redirect: 'error', signal: AbortSignal.timeout(30000) })
      assert.equal(publicRead.status,200,'Corrected upload is not anonymously readable')
      assert.deepEqual(Buffer.from(await publicRead.arrayBuffer()),data)
      console.log('PASS corrected presigned PUT is anonymously readable with exact image bytes')
    } finally {
      if (accepted) {
        const res = await request('DELETE', key)
        assert.equal(res.status,204,'Temporary verification image cleanup failed')
        await res.body?.cancel()
        console.log('Removed the temporary verification image; existing image data was not changed')
      }
    }
  }
}
await main().catch(error => { console.error(error.message); process.exitCode = 1 })

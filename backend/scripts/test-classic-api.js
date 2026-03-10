/**
 * Test script: Classic Autodoc API — test ALL Classic-only accounts
 * Re-establishes session for each company to avoid session corruption.
 */

const CLASSIC_BASE = 'https://projetos3.autodoc.com.br';

class CookieJar {
  constructor() { this.cookies = new Map(); }
  addFromResponse(resp) {
    for (const sc of resp.headers.getSetCookie?.() || []) {
      const cookiePart = sc.split(';')[0];
      const eqIdx = cookiePart.indexOf('=');
      if (eqIdx > 0) this.cookies.set(cookiePart.substring(0, eqIdx), cookiePart.substring(eqIdx + 1));
    }
  }
  set(name, value) { this.cookies.set(name, value); }
  toString() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
}

async function cfetch(url, jar, opts = {}) {
  const fullUrl = url.startsWith('http') ? url : `${CLASSIC_BASE}${url}`;
  const resp = await fetch(fullUrl, {
    ...opts,
    headers: { ...opts.headers, 'Cookie': jar.toString() },
    redirect: 'manual',
  });
  jar.addFromResponse(resp);
  return resp;
}

function decodeHtmlEntities(str) {
  return str.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&ccedil;/g, 'ç').replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ')
    .replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú');
}

/**
 * Establish a fresh Classic session and return { jar, instanceMap }
 */
async function classicLogin(tokens, customerId, customerName) {
  const jar = new CookieJar();
  jar.set('accessToken', tokens.accessToken);
  jar.set('idToken', tokens.idToken);
  jar.set('refreshToken', tokens.refreshToken);
  jar.set('customer_id', customerId);
  jar.set('customer_name', encodeURIComponent(customerName));
  jar.set('last_login', encodeURIComponent(JSON.stringify({ customer_id: customerId, is_nextgen: false })));

  let resp = await cfetch('/LoginSuiteObras', jar);
  if (resp.status !== 302) throw new Error(`LoginSuiteObras: ${resp.status}`);

  resp = await cfetch(resp.headers.get('location'), jar);
  const html = await resp.text();

  // Parse ALL company options
  const optionRegex = /<option\s+value=['"](\d+)['"][^>]*>([^<]+)/gi;
  const instanceMap = new Map(); // decodedName → classicInstanceId
  let m;
  while ((m = optionRegex.exec(html)) !== null) {
    instanceMap.set(decodeHtmlEntities(m[2].trim()), m[1]);
  }

  return { jar, instanceMap };
}

/**
 * Switch to a company and list its projects
 */
async function listClassicProjects(jar, classicInstanceId) {
  // Validate company
  let resp = await cfetch('/Home/Clientes', jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `idEscolhaCliente=${classicInstanceId}`,
  });
  const validation = (await resp.text()).trim();
  if (validation !== '1') return { error: `validation=${validation.substring(0, 50)}` };

  // Navigate to projects
  resp = await cfetch('/Home/Projetos', jar);
  while (resp.status >= 300 && resp.status < 400) {
    resp = await cfetch(resp.headers.get('location'), jar);
  }
  if (resp.status === 200) await resp.text();

  // List projects
  resp = await cfetch('/Diretorios/TreeViewDiretorios/?isListaProjetos=true', jar);
  const body = await resp.text();
  if (!body.startsWith('[')) return { error: 'not JSON' };

  return { projects: JSON.parse(body) };
}

async function main() {
  const email = process.env.AUTODOC_EMAIL;
  const password = process.env.AUTODOC_PASSWORD;

  // SSO Auth
  const authResp = await fetch('https://sso.autodoc.com.br/v1/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
  });
  const authBody = await authResp.json();
  const tokens = {
    idToken: authBody.data?.idToken || authBody.idToken,
    accessToken: authBody.data?.accessToken || authBody.accessToken,
    refreshToken: authBody.data?.refreshToken || authBody.refreshToken,
  };

  // Get customers
  const custResp = await fetch(`https://suite.autodoc.com.br/v2/users/email/${encodeURIComponent(email)}/customers`, {
    headers: { 'Authorization': `Bearer ${tokens.idToken}` },
  });
  const customerList = (await custResp.json())?.data || [];

  // Find Classic-only accounts
  const classicOnly = customerList.filter(c => {
    const products = (c.products || []).map(p => p.code || p.name || p.product);
    return !products.includes('docs');
  });

  console.log(`Total customers: ${customerList.length}, Classic-only: ${classicOnly.length}\n`);

  let totalProjects = 0;

  for (const customer of classicOnly) {
    const name = customer.name;
    const customerId = String(customer.id);

    // Fresh session for each company
    const { jar, instanceMap } = await classicLogin(tokens, customerId, name);

    // Find classic instance ID — try exact match first, then fuzzy
    let classicId = instanceMap.get(name);
    if (!classicId) {
      // Try to find by partial match
      for (const [instName, instId] of instanceMap) {
        if (instName.includes(name) || name.includes(instName) ||
            instName.toLowerCase() === name.toLowerCase()) {
          classicId = instId;
          break;
        }
      }
    }

    if (!classicId) {
      console.log(`❌ ${name}: no classic instance ID found (available: ${[...instanceMap.keys()].join(', ')})`);
      continue;
    }

    const result = await listClassicProjects(jar, classicId);

    if (result.error) {
      console.log(`❌ ${name} (classicId: ${classicId}): ${result.error}`);
    } else {
      totalProjects += result.projects.length;
      console.log(`✅ ${name} (classicId: ${classicId}): ${result.projects.length} projects`);
      for (const p of result.projects) {
        console.log(`   - ${p.name} (id: ${p.id})`);
      }
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n=== TOTAL: ${totalProjects} Classic projects from ${classicOnly.length} accounts ===`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

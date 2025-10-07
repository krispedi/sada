// mutasi_full_fix.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const qs = require('qs');
require('dotenv').config();

puppeteer.use(StealthPlugin());

const URL_HOME = process.env.URL_HOME || 'https://app.orderkuota.com/';
const URL_MUTASI = process.env.URL_MUTASI || 'https://app.orderkuota.com/api/v2/qris/mutasi/2162959';
const APP_REG_ID = process.env.APP_REG_ID || 'dUZJxLkITXu_jC9dtuPPqq:APA91bEPiVyD1dchTRojpguhv15nfHeDRLlPLY4axDmp0gCoG6QiPSX9Xyv0jEjtY31CGhoUCQuFxOEF2DUUshKIQVbBu26g7XRQijkRlkH1djbjYbJnpkn7Jl6ua0xjlyZuwxhhsK9S'; // trim untuk contoh
const PHONE_UUID = process.env.PHONE_UUID || 'dUZJxLkITXu_jC9dtuPPqq';
const PHONE_MODEL = process.env.PHONE_MODEL || '22120RN86G';
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'fahimmuammar';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '2162959:ewcYdHWs7m6pCr9O8iJMZAg0KRTfIPbS';

// optional proxy for puppeteer (e.g. 'http://IP:PORT')
const PUPPETEER_PROXY = process.env.PUPPETEER_PROXY || '';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCloudflareCookies() {
  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'];
  if (PUPPETEER_PROXY) launchArgs.push(`--proxy-server=${PUPPETEER_PROXY}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
    defaultViewport: { width: 1200, height: 800 },
  });

  try {
    const page = await browser.newPage();

    // set UA & headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': URL_HOME
    });

    // go to homepage and wait
    const resp = await page.goto(URL_HOME, { waitUntil: 'networkidle2', timeout: 45000 }).catch(e => null);
    if (resp) {
      console.log('Landing page HTTP status:', resp.status());
      // get response body when status not 200 to see reason
      if (resp.status() !== 200) {
        try {
          const text = await resp.text();
          console.log('Landing page response body (truncated):', text.slice(0, 600));
        } catch (e) {
          // ignore
        }
      }
    } else {
      console.log('No response object from goto (continuing).');
    }

    // wait a short moment to ensure any JS/cookie set completes
    await sleep(4000); // pake sleep instead of page.waitForTimeout for compatibility

    const cookies = await page.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    await browser.close();
    return { cookieHeader, pageCookies: cookies, landingStatus: resp ? resp.status() : null };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function postMutasi(cookieHeader) {
  const data = {
    "app_reg_id": APP_REG_ID,
    "phone_uuid": PHONE_UUID,
    "phone_model": PHONE_MODEL,
    "requests[qris_history][keterangan]": "",
    "requests[qris_history][jumlah]": "",
    "request_time": Date.now(),
    "phone_android_version": "14",
    "app_version_code": "250811",
    "auth_username": AUTH_USERNAME,
    "requests[qris_history][page]": 1,
    "auth_token": AUTH_TOKEN,
    "app_version_name": "25.08.11",
    "ui_mode": "light",
    "requests[qris_history][dari_tanggal]": "",
    "requests[0]": "account",
    "requests[qris_history][ke_tanggal]": ""
  };

  const headers = {
    "Timestamp": String(Date.now()),
    "Content-Type": "application/x-www-form-urlencoded",
    "Host": "app.orderkuota.com",
    "Connection": "Keep-Alive",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "okhttp/4.12.0",
    ...(cookieHeader ? { "Cookie": cookieHeader } : {})
  };

  const axiosConfig = { headers, timeout: 25000, validateStatus: null };
  const res = await axios.post(URL_MUTASI, qs.stringify(data), axiosConfig);
  return res;
}

(function main() {
  (async () => {
    try {
      console.log('Starting Puppeteer (stealth) to obtain cookies/session from Cloudflare...');
      const { cookieHeader, pageCookies, landingStatus } = await getCloudflareCookies();
      console.log('Got cookie header length:', cookieHeader ? cookieHeader.length : 0);
      console.log('Landing status:', landingStatus);

      if (!cookieHeader) {
        console.warn('No cookies obtained. If Cloudflare returned 403, try using a proxy or run Puppeteer on a different IP.');
      }

      console.log('Posting to mutasi endpoint via axios using cookie header...');
      const response = await postMutasi(cookieHeader);

      console.log('Mutasi endpoint status:', response.status);
      // show raw when not JSON
      if (typeof response.data === 'string') {
        console.log('Raw response (truncated):', response.data.slice(0, 800));
      } else {
        // attempt parsing similar to original
        const parsed = (function parse(responseData) {
          const results = [];
          if (responseData && responseData.qris_history && Array.isArray(responseData.qris_history.results)) {
            for (const trx of responseData.qris_history.results) {
              if ((trx.status ?? '') === 'IN') {
                results.push({
                  date: trx.tanggal,
                  amount: (trx.kredit ?? '').toString().replace(/\./g, ''),
                  type: 'CR',
                  qris: 'static',
                  brand_name: trx.brand?.name || '',
                  issuer_reff: trx.id,
                  buyer_reff: (trx.keterangan || '').trim(),
                  balance: trx.saldo_akhir
                });
              }
            }
          }
          return { status: 'success', total: results.length, data: results };
        })(response.data);

        console.log(JSON.stringify(parsed, null, 2));
      }
    } catch (err) {
      console.error('Error caught:', err && err.message ? err.message : err);
      if (err.response && err.response.data) {
        console.error('Axios error data (truncated):', JSON.stringify(err.response.data).slice(0, 600));
      } else if (err.stack) {
        console.error(err.stack.split('\n').slice(0, 10).join('\n'));
      }
      console.log('\nPossible fixes:\n - run on different IP or use proxy (set PUPPETEER_PROXY env),\n - try headless:false locally to see challenge,\n - use puppeteer on VPS with different IP if current IP is blocked.\n');
      process.exit(1);
    }
  })();
})();

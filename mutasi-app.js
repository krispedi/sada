// mutasi.js
const axios = require("axios");
const qs = require("qs"); // untuk encode x-www-form-urlencoded

(async () => {
  try {
    const url = "https://app.orderkuota.com/api/v2/qris/mutasi/2162959";

    const data = {
      "app_reg_id":
        "dUZJxLkITXu_jC9dtuPPqq:APA91bEPiVyD1dchTRojpguhv15nfHeDRLlPLY4axDmp0gCoG6QiPSX9Xyv0jEjtY31CGhoUCQuFxOEF2DUUshKIQVbBu26g7XRQijkRlkH1djbjYbJnpkn7Jl6ua0xjlyZuwxhhsK9S",
      "phone_uuid": "dUZJxLkITXu_jC9dtuPPqq",
      "phone_model": "22120RN86G",
      "requests[qris_history][keterangan]": "",
      "requests[qris_history][jumlah]": "",
      "request_time": Date.now(),
      "phone_android_version": "14",
      "app_version_code": "250811",
      "auth_username": "fahimmuammar",
      "requests[qris_history][page]": 1,
      "auth_token": "2162959:ewcYdHWs7m6pCr9O8iJMZAg0KRTfIPbS",
      "app_version_name": "25.08.11",
      "ui_mode": "light",
      "requests[qris_history][dari_tanggal]": "",
      "requests[0]": "account",
      "requests[qris_history][ke_tanggal]": ""
    };

    const headers = {
      "Timestamp": Date.now(),
      "Content-Type": "application/x-www-form-urlencoded",
      "Host": "app.orderkuota.com",
      "Connection": "Keep-Alive",
      "Accept-Encoding": "gzip",
      "User-Agent": "okhttp/4.12.0"
    };

    // kirim POST request
    const response = await axios.post(url, qs.stringify(data), { headers });

    const responseData = response.data;
    const results = [];

    if (
      responseData.qris_history &&
      Array.isArray(responseData.qris_history.results)
    ) {
      for (const trx of responseData.qris_history.results) {
        if ((trx.status ?? "") === "IN") {
          results.push({
            date: trx.tanggal,
            amount: trx.kredit.replace(/\./g, ""),
            type: "CR",
            qris: "static",
            brand_name: trx.brand?.name || "",
            issuer_reff: trx.id,
            buyer_reff: (trx.keterangan || "").trim(),
            balance: trx.saldo_akhir
          });
        }
      }
    }

    console.log(JSON.stringify({ status: "success", total: results.length, data: results }, null, 2));
  } catch (err) {
    console.error("Error request:", err.response?.data || err.message);
  }
})();

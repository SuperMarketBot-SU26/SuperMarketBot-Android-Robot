const fs = require('fs');
const path = require('path');
const https = require('https');

async function getGofileServer() {
  return new Promise((resolve, reject) => {
    https.get('https://api.gofile.io/servers', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'ok' && parsed.data.servers.length > 0) {
            resolve(parsed.data.servers[0].name);
          } else {
            reject(new Error('No server available'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function uploadToGofile() {
  try {
    const server = await getGofileServer();
    console.log('Selected Gofile server:', server);

    const apkPath = path.join(__dirname, '..', 'SuperMarketBot-Robot-App.apk');
    const stats = fs.statSync(apkPath);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const crlf = '\r\n';

    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="SuperMarketBot-Robot-App.apk"${crlf}Content-Type: application/vnd.android.package-archive${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;

    const contentLength = Buffer.byteLength(header) + stats.size + Buffer.byteLength(footer);

    const options = {
      hostname: `${server}.gofile.io`,
      port: 443,
      path: '/contents/uploadfile',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': contentLength
      }
    };

    console.log('Starting upload to Gofile...');
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.status === 'ok') {
            console.log('UPLOAD_SUCCESS');
            console.log('Download Page:', json.data.downloadPage);
            console.log('File ID:', json.data.fileId);
          } else {
            console.error('Upload failed with status:', json);
          }
        } catch (e) {
          console.error('Response parse error:', body);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
    });

    req.write(header);
    const fileStream = fs.createReadStream(apkPath);
    fileStream.on('data', (chunk) => {
      req.write(chunk);
    });
    fileStream.on('end', () => {
      req.write(footer);
      req.end();
      console.log('All bytes sent to server. Waiting for response...');
    });

  } catch (err) {
    console.error('Upload failed:', err);
  }
}

uploadToGofile();

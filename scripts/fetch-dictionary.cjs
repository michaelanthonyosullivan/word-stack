const https = require('https');
const fs = require('fs');
const path = require('path');

const SOWPODS_URL = 'https://raw.githubusercontent.com/jmlewis/valett/master/scrabble/sowpods.txt';
const COMMON_URL = 'https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt';

const DICT_PATH = path.join(__dirname, '../public/dictionary.txt');
const COMMON_PATH = path.join(__dirname, '../public/common_words.txt');

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: Status Code ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const lines = data.split(/\r?\n/);
        const filtered = lines
          .map(w => w.trim().toUpperCase())
          .filter(w => w.length >= 2 && w.length <= 10 && /^[A-Z]+$/.test(w));
        
        filtered.sort();
        
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, filtered.join('\n'), 'utf8');
        
        console.log(`Saved ${filtered.length} words to: ${outputPath}`);
        resolve();
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    await Promise.all([
      downloadFile(SOWPODS_URL, DICT_PATH),
      downloadFile(COMMON_URL, COMMON_PATH)
    ]);
    console.log('All word lists downloaded and compiled successfully.');
  } catch (err) {
    console.error('Error during word lists compilation:', err.message);
    process.exit(1);
  }
}

main();

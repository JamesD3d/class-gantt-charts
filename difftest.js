const fs = require('fs');
const html162 = fs.readFileSync('html162.txt', 'utf8');
const html96 = fs.readFileSync('html96.txt', 'utf8');

if (html162 === html96) {
    console.log("HTML contents are IDENTICAL.");
} else {
    console.log("HTML contents DIFFER.");
}

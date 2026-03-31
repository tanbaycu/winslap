const sharp = require('sharp');
sharp('public/icon.svg')
  .resize(256, 256)
  .png()
  .toFile('public/icon.png')
  .then(() => console.log('Icon converted!'))
  .catch(err => console.error(err));

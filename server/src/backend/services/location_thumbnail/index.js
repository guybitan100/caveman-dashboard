'use strict';

const fs = require('fs');
const staticmaps = require('staticmaps');
const AWS = require('aws-sdk');
const MD5 = require("crypto-js/md5");

const BUCKET_NAME = process.env.BUCKET_NAME;
const PREFIX = process.env.PREFIX;
const s3 = new AWS.S3();

const uploadFile = (filename, filePath) => {
  const fileContent = fs.readFileSync(filePath);

  const params = {
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: fileContent,
  };

  s3.upload(params, (err, data) => {
    if (err) {
      console.log(err);
    }
  });

  const fileMd5 = MD5(fileContent).toString();

  fs.unlink(filePath, (err) => {
    if (err) throw err;
    console.log(`successfully deleted ${filePath}`);
  });

  console.log('Success');

  return fileMd5;
};

const uploadAndSendResponse = (prefix, imgname, filePath, callback) => {

  if (prefix) {
    imgname = `${prefix}/${imgname}`;
  }

  imgname = `${PREFIX}/${imgname}`;  

  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;

  const fileMd5 = uploadFile(imgname, filePath);

  callback({
      path: imgname,
      size: fileSizeInBytes,
      md5: fileMd5,
  });
};

const generateThumbnail = (width, height, zoom, center) => {
  const map = new staticmaps({
    width: width,
    height: height,
    zoom: zoom,
    center: center,
  });

  const marker = {
    img: 'https://i.imgur.com/OGMRWnh.png',
    width: 40,
    height: 40,
    coord: center,
  };

  console.log('adding marker...');

  map.addMarker(marker);

  console.log('added');

  return map;
};

module.exports.handler = (event, context, callback) => {

    const {
      lat = 37.7955843,
      lng = -122.3934109,
      zoom = 15,
      width = 400,
      height = 220,
      prefix = ''
    } = event;


  const imgname = `${lat}_${lng}_${zoom}.png`;

  const path = `/tmp/${imgname}`;

  console.log('imgname', imgname);

  if (!fs.existsSync(path)) {
    console.log('does not exist, generating...');

    const center = [lng, lat];

    const map = generateThumbnail(width, height, zoom, center);

    map
      .render(center, zoom)
      .then(() => {
        console.log('saving...');

        map.image
          .save(path)
          .then(() => {
            console.log('saved');

            uploadAndSendResponse(prefix, imgname, path, callback);
          })
          .catch((savex) => {
            console.log(savex.message);
            console.log(savex);
          });
      })
      .catch((err) => {
        console.log(`map: `, err.message);
        console.log(err);
      });
  } else {
    console.log('already exists');

    uploadAndSendResponse(prefix, imgname, path, callback);
  }
};

import React from 'react';
// @ts-ignore
const QRCode = require('qrcode.react');
const QRCodeWrapper = (props: any) => <QRCode {...props} />;
export default QRCodeWrapper; 
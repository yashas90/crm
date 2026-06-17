#!/usr/bin/env node
/**
 * Print base64 SPKI SHA-256 pins for a host (for mobile SSL pinning).
 * Usage: node scripts/mobile-extract-cert-pin.js crm-production-6cfe.up.railway.app
 */
const tls = require("node:tls");
const crypto = require("node:crypto");

const host = process.argv[2];
if (!host) {
  console.error("Usage: node scripts/mobile-extract-cert-pin.js <hostname>");
  process.exit(1);
}

function spkiPin(cert) {
  const pem = `-----BEGIN CERTIFICATE-----\n${cert.raw
    .toString("base64")
    .match(/.{1,64}/g)
    .join("\n")}\n-----END CERTIFICATE-----`;
  const x509 = new crypto.X509Certificate(pem);
  const spki = x509.publicKey.export({ type: "spki", format: "der" });
  return crypto.createHash("sha256").update(spki).digest("base64");
}

const socket = tls.connect(443, host, { servername: host }, () => {
  const leaf = socket.getPeerCertificate(false);
  const issuer = socket.getPeerCertificate(true).issuerCertificate;
  console.log(`Host: ${host}`);
  console.log(`Leaf (${leaf.subject.CN}): ${spkiPin(leaf)}`);
  if (issuer) {
    console.log(`Issuer (${issuer.subject.CN}): ${spkiPin(issuer)}`);
  }
  socket.end();
});

socket.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

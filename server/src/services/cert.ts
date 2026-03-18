import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

export interface CertResult {
  cert: string;
  key: string;
}

export async function issueClientCertificate(
  clientId: string,
  caCertPath: string,
  caKeyPath: string,
  caKeyPassword: string
): Promise<CertResult> {
  const prefix = join(tmpdir(), `mycarium-cert-${randomUUID()}`);
  const keyPath = `${prefix}.key`;
  const csrPath = `${prefix}.csr`;
  const certPath = `${prefix}.crt`;

  try {
    // Step 1: Generate client private key (no password)
    await execFileAsync("openssl", [
      "genrsa", "-out", keyPath, "2048",
    ]);

    // Step 2: Create CSR with client_id as CN
    await execFileAsync("openssl", [
      "req", "-new",
      "-key", keyPath,
      "-out", csrPath,
      "-subj", `/CN=${clientId}`,
    ]);

    // Step 3: Sign CSR with CA
    await execFileAsync("openssl", [
      "x509", "-req",
      "-in", csrPath,
      "-CA", caCertPath,
      "-CAkey", caKeyPath,
      "-CAcreateserial",
      "-out", certPath,
      "-days", "365",
      "-passin", `pass:${caKeyPassword}`,
    ]);

    const cert = readFileSync(certPath, "utf-8");
    const key = readFileSync(keyPath, "utf-8");

    return { cert, key };
  } finally {
    // Clean up temp files
    for (const f of [keyPath, csrPath, certPath]) {
      try { unlinkSync(f); } catch { /* ignore */ }
    }
  }
}

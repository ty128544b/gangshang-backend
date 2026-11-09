// 本地文件 blob 存储：替代空间的 ctx.blobs。
// put(key, bytes) 写到 $DATA_DIR/blobs/<key>，附带 .meta.json 存 contentType；
// getUrl 返回同源路径 /blobs/<key>，由 server.ts 直接提供下载。
// key 只允许字母、数字与 - _ . /，防止路径穿越。
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type {
  BlobClient,
  BlobPutData,
  BlobPutOptions,
  BlobUrlOptions,
} from "./shim";

function assertSafeKey(key: string): void {
  if (
    !key ||
    key.includes("..") ||
    key.startsWith("/") ||
    !/^[A-Za-z0-9._\-\/]+$/.test(key)
  ) {
    throw new Error(`invalid blob key: ${key}`);
  }
}

function toBuffer(data: Exclude<BlobPutData, Blob>): Buffer {
  if (typeof data === "string") return Buffer.from(data, "utf-8");
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data as unknown as Uint8Array);
}

export class LocalBlobStore implements BlobClient {
  constructor(
    private readonly dir: string,
    private readonly publicBase: string = "",
  ) {}

  private filePath(key: string): string {
    assertSafeKey(key);
    const p = resolve(join(this.dir, key));
    if (!p.startsWith(resolve(this.dir) + "/")) {
      throw new Error(`invalid blob key: ${key}`);
    }
    return p;
  }

  async put(
    key: string,
    data: BlobPutData,
    options?: BlobPutOptions,
  ): Promise<void> {
    const p = this.filePath(key);
    mkdirSync(dirname(p), { recursive: true });
    let bytes: Buffer;
    if (data instanceof Blob) {
      bytes = Buffer.from(await data.arrayBuffer());
    } else {
      bytes = toBuffer(data);
    }
    writeFileSync(p, bytes);
    writeFileSync(
      `${p}.meta.json`,
      JSON.stringify({
        contentType: options?.contentType ?? "application/octet-stream",
        size: bytes.length,
      }),
    );
  }

  async getUrl(key: string, _options?: BlobUrlOptions): Promise<string> {
    const parts = key.split("/").map(encodeURIComponent).join("/");
    return `${this.publicBase}/blobs/${parts}`;
  }

  async delete(key: string): Promise<void> {
    const p = this.filePath(key);
    rmSync(p, { force: true });
    rmSync(`${p}.meta.json`, { force: true });
  }

  /** 供 HTTP 层直接提供文件下载：返回 {buffer, contentType}，不存在返回 null。 */
  async read(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const p = this.filePath(key);
    try {
      const buffer = await readFile(p);
      let contentType = "application/octet-stream";
      try {
        const meta = JSON.parse(
          await readFile(`${p}.meta.json`, "utf-8"),
        ) as { contentType?: string };
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        /* 无 meta 则用默认类型 */
      }
      return { buffer, contentType };
    } catch {
      return null;
    }
  }
}

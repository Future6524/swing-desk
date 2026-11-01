"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { requireAdmin } from "@/lib/session";
import { appendEvent, createSetup, DomainError, type EventInput, type ImageInput } from "@/lib/setups";
import type { CloseReason, Direction } from "@/lib/types";

export type FormState = { error?: string } | undefined;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Identify uploads by their magic bytes rather than trusting the browser's MIME type.
function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP")
    return "image/webp";
  return null;
}

async function readImage(v: FormDataEntryValue | null): Promise<ImageInput | undefined> {
  if (!(v instanceof File) || v.size === 0) return undefined;
  if (v.size > MAX_IMAGE_BYTES) throw new DomainError("Chart image must be 4 MB or smaller.");
  const data = new Uint8Array(await v.arrayBuffer());
  const mime = sniff(data);
  if (!mime) throw new DomainError("Chart must be a PNG, JPEG, WebP or GIF image.");
  return { mime, data };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function price(fd: FormData, k: string): number | undefined {
  const s = str(fd, k).replace(/,/g, "");
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) throw new DomainError(`"${s}" is not a valid price.`);
  return n;
}

function fail(e: unknown): FormState {
  if (e instanceof DomainError) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong saving this. Nothing was recorded." };
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await checkPassword(str(fd, "password")))) return { error: "Incorrect password." };
  const { token, maxAge } = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}

export async function createSetupAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let id: number;
  try {
    const direction = str(fd, "direction") as Direction;
    if (direction !== "LONG" && direction !== "SHORT") throw new DomainError("Choose long or short.");
    const entry = price(fd, "entry");
    const stop = price(fd, "stop");
    if (entry == null || stop == null) throw new DomainError("Entry and stop loss are required.");
    const targets = fd
      .getAll("target")
      .map((v) => String(v).trim())
      .filter(Boolean)
      .map((v) => {
        const n = Number(v.replace(/,/g, ""));
        if (!Number.isFinite(n) || n <= 0) throw new DomainError(`"${v}" is not a valid target.`);
        return n;
      });
    id = await createSetup({
      ticker: str(fd, "ticker"),
      direction,
      analysis: str(fd, "analysis"),
      entry,
      stop,
      targets,
      chart: await readImage(fd.get("chart")),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/setups/${id}?created=1`);
}

export async function appendEventAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const setupId = Number(fd.get("setupId"));
  try {
    const note = str(fd, "note") || undefined;
    const image = await readImage(fd.get("chart"));
    const kind = str(fd, "kind");
    let input: EventInput;
    switch (kind) {
      case "STATUS":
        input = { kind, price: price(fd, "price"), note, image };
        break;
      case "TARGET_HIT":
        input = { kind, price: price(fd, "price"), stop: price(fd, "stop"), note, image };
        break;
      case "STOP_ADJUSTED": {
        const stop = price(fd, "stop");
        if (stop == null) throw new DomainError("Enter the new stop.");
        input = { kind, stop, note, image };
        break;
      }
      case "NOTE":
        input = { kind, note: note ?? "", image };
        break;
      case "CLOSED":
        input = { kind, reason: str(fd, "reason") as CloseReason, price: price(fd, "price"), note, image };
        if (!["TARGET", "STOPPED", "MANUAL", "INVALIDATED"].includes(input.reason))
          throw new DomainError("Choose a close reason.");
        break;
      default:
        throw new DomainError("Choose an update type.");
    }
    await appendEvent(setupId, input);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/setups/${setupId}?saved=1`);
}

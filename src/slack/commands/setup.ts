import { z } from "zod";
import { getConfig } from "../../config";
import { logProfileEvent, upsertProfile } from "../../db/queries";
import { logger } from "../../logger";
import { encrypt } from "../../utils/crypto";
import { openDM, openModal, postMessage } from "../client";
import { buildProfileSaved, buildSetupModal } from "../messages";

const log = logger.child({ module: "cmd:setup" });

const setupSchema = z.object({
  name: z.string().min(1).max(100),
  empresa: z
    .string()
    .regex(/^\d{1,10}$/, "Empresa must be numeric (up to 10 digits)"),
  rut: z.string().regex(/^\d{10,14}$/, "RUT must be 10-14 digits"),
  documento: z.string().regex(/^\d{6,10}$/, "Documento must be 6-10 digits"),
  fechaNac: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Fecha de nacimiento must be DD/MM/YYYY"),
});

export async function handleSetup(
  triggerId: string,
  userId: string,
  userName: string,
): Promise<string> {
  log.info({ userId }, "Opening setup modal");
  const modal = buildSetupModal(userName);
  await openModal(triggerId, modal);
  return "";
}

export async function handleSetupSubmission(
  workspaceId: string,
  userId: string,
  values: Record<string, Record<string, { value: string }>>,
): Promise<void> {
  const raw = {
    name: values.name_block.name_input.value,
    empresa: values.empresa_block.empresa_input.value,
    rut: values.rut_block.rut_input.value,
    documento: values.documento_block.documento_input.value,
    fechaNac: values.fecha_nac_block.fecha_nac_input.value,
  };

  const parsed = setupSchema.parse(raw);
  const config = getConfig();

  const encEmpresa = encrypt(parsed.empresa, config.ENCRYPTION_KEY);
  const encRut = encrypt(parsed.rut, config.ENCRYPTION_KEY);
  const encDocumento = encrypt(parsed.documento, config.ENCRYPTION_KEY);
  const encFechaNac = encrypt(parsed.fechaNac, config.ENCRYPTION_KEY);

  await upsertProfile(
    workspaceId,
    userId,
    parsed.name,
    encEmpresa,
    encRut,
    encDocumento,
    encFechaNac,
  );

  await logProfileEvent(workspaceId, userId, parsed.name, "setup");

  log.info({ userId, name: parsed.name }, "Profile saved");

  try {
    const dmChannel = await openDM(userId);
    const msg = buildProfileSaved(parsed.name);
    await postMessage(dmChannel, msg.text, msg.blocks);
  } catch (err) {
    log.warn({ err, userId }, "Failed to send setup confirmation DM");
  }
}

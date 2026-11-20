import { describe, expect, it, vi } from "vitest";
import { activeAudioConsent, requireAudioConsent, type AudioConsentEvent } from "./audio-consent";

const event = (patch: Partial<AudioConsentEvent> = {}): AudioConsentEvent => ({
  id: "permission-1",
  revision: 1,
  client_id: "case",
  professional_id: "owner",
  scope: "recording",
  granted: true,
  source: "written",
  created_at: "2026-11-20T15:30:00Z",
  ...patch,
});

describe("autorizações de áudio", () => {
  it("mantém decisão vigente por finalidade e não reativa consentimento anterior", () => {
    const recording = event();
    const processing = event({ id: "permission-2", scope: "external_processing", revision: 2 });
    const revoke = event({ id: "permission-3", revision: 3, granted: false });
    expect(activeAudioConsent([processing, recording], "recording")).toEqual(recording);
    expect(activeAudioConsent([revoke, processing, recording], "recording")).toBeUndefined();
    expect(activeAudioConsent([revoke, processing, recording], "external_processing")).toEqual(
      processing,
    );
  });

  it("exige confirmação nova no banco e não usa uma concessão antiga", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValue({
          data: event({ id: "permission-2" }),
        }),
    };
    const db = { from: vi.fn().mockReturnValue(query) } as unknown as Parameters<
      typeof requireAudioConsent
    >[0];
    await expect(requireAudioConsent(db, "case", "recording")).rejects.toThrow(
      "autorização vigente",
    );
    await expect(requireAudioConsent(db, "case", "recording", "permission-1")).rejects.toThrow(
      "autorização vigente",
    );
    await expect(
      requireAudioConsent(db, "case", "recording", "permission-2"),
    ).resolves.toMatchObject({ id: "permission-2" });
    expect(query.eq).toHaveBeenCalledWith("client_id", "case");
    expect(query.eq).toHaveBeenCalledWith("scope", "recording");
    expect(query.order).toHaveBeenCalledWith("revision", { ascending: false });
  });
});

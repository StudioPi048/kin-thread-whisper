import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, parsePreferences } from "./preferences";

describe("preferências", () => {
  it("valores ausentes ou inválidos caem no padrão", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences({ textSize: "huge", reduceMotion: "yes", agendaView: 3 })).toEqual(DEFAULT_PREFERENCES);
  });
  it("lê valores válidos", () => {
    expect(parsePreferences({ textSize: "large", reduceMotion: true, agendaView: "week" })).toEqual({
      textSize: "large",
      reduceMotion: true,
      agendaView: "week",
    });
  });
});

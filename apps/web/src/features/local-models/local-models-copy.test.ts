import { afterEach, describe, expect, it } from "vitest";

import { resetLanguageForTest, setLanguage, translate } from "@/i18n/language";
import zhCN from "@/i18n/locales/zh-CN.json";

import { byokFailureCopy, modelSourceFailureCopy } from "./local-models-copy";

afterEach(() => {
  resetLanguageForTest();
});

describe("local-models-copy model source failures", () => {
  it("preserves BYOK gateway detail and forwarded BYOK endpoint refusal messages", () => {
    expect(
      modelSourceFailureCopy(
        {
          code: "BYOK_GATEWAY_FAILED",
          details: [{ field: "gateway", reason: "  port 18100 in use  " }],
          message: "The Computer could not configure its local BYOK gateway",
        },
        translate,
      ),
    ).toBe(
      "The computer couldn't configure its local BYOK gateway: port 18100 in use",
    );
    expect(
      modelSourceFailureCopy(
        {
          code: "BYOK_AUTH_FAILED",
          message:
            "  https://api.example.com/v1/chat/completions rejected the API key (HTTP 401).  ",
        },
        translate,
      ),
    ).toBe(
      "https://api.example.com/v1/chat/completions rejected the API key (HTTP 401).",
    );
  });

  it("filters empty, raw-code, and generic TeamHub fallback strings so localized copy shows", async () => {
    const englishAuthDefault = "The endpoint rejected the API key.";
    const englishNotFoundDefault =
      "Nothing answered at the endpoint's address, or it doesn't serve this model ID.";
    const englishSwitchDefault = "The computer couldn't switch. Try again.";
    const englishInvalidConfigDefault =
      "The computer can't use this endpoint. An HTTPS endpoint needs an API key; plain HTTP works only on this computer or your local network.";

    expect(byokFailureCopy("BYOK_AUTH_FAILED", "", translate)).toBe(
      englishAuthDefault,
    );
    expect(byokFailureCopy("BYOK_AUTH_FAILED", "   ", translate)).toBe(
      englishAuthDefault,
    );
    expect(
      byokFailureCopy("BYOK_AUTH_FAILED", "BYOK_AUTH_FAILED", translate),
    ).toBe(englishAuthDefault);
    expect(
      byokFailureCopy(
        "BYOK_AUTH_FAILED",
        "The endpoint rejected the API key",
        translate,
      ),
    ).toBe(englishAuthDefault);
    expect(
      byokFailureCopy(
        "BYOK_NOT_FOUND",
        "Nothing answered at the endpoint address, or it does not serve this model",
        translate,
      ),
    ).toBe(englishNotFoundDefault);

    // Non-passthrough codes stay on localized client copy.
    expect(
      modelSourceFailureCopy(
        {
          code: "MODEL_SOURCE_FAILED",
          message: "raw server text",
        },
        translate,
      ),
    ).toBe(englishSwitchDefault);
    expect(
      modelSourceFailureCopy(
        {
          code: "BYOK_INVALID_CONFIG",
          message: "raw server text",
        },
        translate,
      ),
    ).toBe(englishInvalidConfigDefault);

    // In Simplified Chinese, generic TeamHub English fallbacks must not leak.
    await setLanguage("zh-CN");
    expect(
      byokFailureCopy(
        "BYOK_AUTH_FAILED",
        "The endpoint rejected the API key",
        translate,
      ),
    ).toBe(zhCN.localModels.sourceByokAuthFailed);
    expect(
      byokFailureCopy(
        "BYOK_UNREACHABLE",
        "The Computer could not reach the endpoint",
        translate,
      ),
    ).toBe(zhCN.localModels.sourceByokUnreachable);
    expect(
      byokFailureCopy(
        "BYOK_UPSTREAM_REJECTED",
        "The endpoint rejected the test request",
        translate,
      ),
    ).toBe(zhCN.localModels.sourceByokUpstreamRejected);
  });

  it("distinguishes BYOK probe timeout wording from model-source switch timeout wording", async () => {
    const switchTimeout = modelSourceFailureCopy(
      {
        code: "MODEL_SOURCE_UNCONFIRMED",
        message: "The Computer did not answer in time",
      },
      translate,
    );
    const probeTimeoutUnconfirmed = byokFailureCopy(
      "MODEL_SOURCE_UNCONFIRMED",
      "The Computer did not answer in time",
      translate,
    );
    const probeTimeoutCheck = byokFailureCopy(
      "BYOK_CHECK_TIMEOUT",
      "The endpoint probe timed out",
      translate,
    );

    expect(switchTimeout).toBe(
      "The computer didn't answer in time. It may still be switching; check again in a minute.",
    );
    expect(probeTimeoutUnconfirmed).toBe(
      "The computer didn't answer in time while checking the endpoint. Try again.",
    );
    expect(probeTimeoutCheck).toBe(probeTimeoutUnconfirmed);
    expect(probeTimeoutUnconfirmed).not.toContain("switching");

    await setLanguage("zh-CN");
    expect(
      modelSourceFailureCopy({ code: "MODEL_SOURCE_UNCONFIRMED" }, translate),
    ).toBe(zhCN.localModels.sourceUnconfirmed);
    expect(byokFailureCopy("MODEL_SOURCE_UNCONFIRMED", "", translate)).toBe(
      zhCN.localModels.sourceByokProbeUnconfirmed,
    );
    expect(byokFailureCopy("BYOK_CHECK_TIMEOUT", "", translate)).toBe(
      zhCN.localModels.sourceByokProbeUnconfirmed,
    );
  });
});

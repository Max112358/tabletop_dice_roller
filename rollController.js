window.DiceApp = window.DiceApp || {};

DiceApp.executeRoll = function (label, formula, note, buttonElement) {
  const missing = DiceApp.getMissingVariables(formula);
  if (missing.length > 0) {
    showStatus(`Cannot roll! Missing variables: ${missing.join(", ")}`, true);
    return;
  }

  const currentTime = Date.now();
  const rollData = DiceApp.parseAndRoll(label, formula);

  if (!rollData || isNaN(rollData.total)) {
    showStatus("Error evaluating math or dice formula! Check syntax.", true);
    return;
  }

  if (rollData.isCritSuccess) {
    DiceApp.triggerCritSuccessVisuals();
  } else if (rollData.isCritFail) {
    DiceApp.triggerCritFailVisuals();
  } else if (rollData.isSuccess === true) {
    DiceApp.triggerBackgroundFlash(
      DiceApp.success_color,
      DiceApp.success_fail_flash_duration,
    );
  } else if (rollData.isSuccess === false) {
    DiceApp.triggerBackgroundFlash(
      DiceApp.fail_color,
      DiceApp.success_fail_flash_duration,
    );
  }

  let singleLineOutput = `*${DiceApp.currentCharacter} rolls ${label} (${formula}):* **${rollData.total}**`;
  if (rollData.dhContext) singleLineOutput += ` ${rollData.dhContext}`;
  if (rollData.breakdown)
    singleLineOutput += ` [Details: ${rollData.breakdown}]`;
  if (note) singleLineOutput += ` *(${note})*`;

  if (currentTime - DiceApp.lastRollTime > DiceApp.COMBO_TIMEOUT_MS) {
    DiceApp.rollBuffer = [];
  }

  DiceApp.rollBuffer.push(singleLineOutput);
  DiceApp.lastRollTime = currentTime;

  const combinedOutputText = DiceApp.rollBuffer.join("\n");

  navigator.clipboard
    .writeText(combinedOutputText)
    .then(() => {
      showStatus(
        DiceApp.rollBuffer.length > 1
          ? `Combined sequence copy active (${DiceApp.rollBuffer.length} rolls)!`
          : `Copied roll for ${label}!`,
      );

      document.getElementById("resTitle").innerHTML =
        `Active Stack: <strong>${DiceApp.rollBuffer.length} Roll(s)</strong>`;
      document.getElementById("resRaw").innerText = combinedOutputText;

      const timerBadge = document.getElementById("bufferTimer");
      timerBadge.style.display = "inline-block";
      timerBadge.innerText = `Combo active: +10s added`;

      if (buttonElement) {
        if (buttonElement._flashTimeout) {
          clearTimeout(buttonElement._flashTimeout);
        }

        if (!buttonElement.dataset.originalText) {
          buttonElement.dataset.originalText = buttonElement.innerText;
        }

        const originalText = buttonElement.dataset.originalText;
        buttonElement.innerText = "✓ Added!";
        buttonElement.classList.add("success-flash");

        buttonElement._flashTimeout = setTimeout(() => {
          buttonElement.innerText = originalText;
          buttonElement.classList.remove("success-flash");
          delete buttonElement.dataset.originalText;
          buttonElement._flashTimeout = null;
        }, 600);
      }
    })
    .catch(() => {
      showStatus("Clipboard execution error!", true);
    });
};

setInterval(() => {
  if (DiceApp.rollBuffer.length > 0) {
    const timePassed = Date.now() - DiceApp.lastRollTime;
    const timerBadge = document.getElementById("bufferTimer");

    if (timePassed > DiceApp.COMBO_TIMEOUT_MS) {
      timerBadge.style.display = "none";
      document.getElementById("resTitle").innerHTML =
        `Stack Expired <span style="font-size:12px; font-weight:normal; color:#a6adc8;">(Next click resets)</span>`;
    } else {
      const remainingSeconds = (
        (DiceApp.COMBO_TIMEOUT_MS - timePassed) /
        1000
      ).toFixed(1);
      timerBadge.innerText = `Combo Window: ${remainingSeconds}s`;
    }
  }
}, 200);

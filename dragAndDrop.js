window.DiceApp = window.DiceApp || {};

DiceApp.setupVariableDragAndDrop = function (onReorder) {
  const container = document.getElementById("varContainer");
  if (!container || container._customDragSetup) return;
  container._customDragSetup = true;

  let dragState = null;

  function getBadgeFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest(".var-badge") : null;
  }

  container.addEventListener("pointerdown", (e) => {
    const badge = e.target.closest(".var-badge");
    if (!badge) return;
    if (e.target.closest("input, button, .var-del-btn")) return;

    dragState = {
      name: badge.dataset.varname,
      sourceBadge: badge,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
  });

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    if (!dragState.isDragging) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.sqrt(dx * dx + dy * dy) <= 5) return;

      dragState.isDragging = true;
      dragState.sourceBadge.classList.add("dragging");
      dragState.sourceBadge.style.pointerEvents = "none";
      dragState.sourceBadge.setPointerCapture(e.pointerId);
    }

    e.preventDefault();

    const targetBadge = getBadgeFromPoint(e.clientX, e.clientY);
    container.querySelectorAll(".var-badge").forEach((el) => {
      const isTarget =
        targetBadge &&
        targetBadge !== dragState.sourceBadge &&
        targetBadge.dataset.varname !== dragState.name &&
        el === targetBadge;
      el.classList.toggle("drag-target", isTarget);
    });
  }

  function endDrag(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    let didReorder = false;

    if (dragState.isDragging) {
      const targetBadge = getBadgeFromPoint(e.clientX, e.clientY);

      if (targetBadge && targetBadge.dataset.varname !== dragState.name) {
        const variables = DiceApp.database[DiceApp.currentCharacter].variables;
        const keys = Object.keys(variables);
        const sourceIndex = keys.indexOf(dragState.name);
        const targetIndex = keys.indexOf(targetBadge.dataset.varname);

        if (sourceIndex !== -1 && targetIndex !== -1) {
          keys.splice(sourceIndex, 1);
          keys.splice(targetIndex, 0, dragState.name);

          const newVariables = {};
          keys.forEach((k) => (newVariables[k] = variables[k]));
          DiceApp.database[DiceApp.currentCharacter].variables = newVariables;
          DiceApp.saveToStorage();
          didReorder = true;
        }
      }

      dragState.sourceBadge.style.pointerEvents = "";
      dragState.sourceBadge.classList.remove("dragging");
      container
        .querySelectorAll(".var-badge")
        .forEach((el) => el.classList.remove("drag-target"));

      if (dragState.sourceBadge.hasPointerCapture(e.pointerId)) {
        dragState.sourceBadge.releasePointerCapture(e.pointerId);
      }
    }

    if (didReorder) onReorder();
    dragState = null;
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
};

DiceApp.setupButtonDragAndDrop = function (onReorder) {
  const grid = document.getElementById("diceGrid");
  if (!grid || grid._customDragSetup) return;
  grid._customDragSetup = true;

  let dragState = null;

  function getCardFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest(".dice-btn") : null;
  }

  grid.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".dice-btn");
    if (!card) return;
    if (e.target.closest(".delete-corner-btn")) return;

    dragState = {
      index: parseInt(card.dataset.index, 10),
      sourceCard: card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
  });

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    if (!dragState.isDragging) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (Math.sqrt(dx * dx + dy * dy) <= 5) return;

      dragState.isDragging = true;
      dragState.sourceCard.classList.add("dragging");
      dragState.sourceCard.style.pointerEvents = "none";
      dragState.sourceCard.setPointerCapture(e.pointerId);
    }

    e.preventDefault();

    const targetCard = getCardFromPoint(e.clientX, e.clientY);
    grid.querySelectorAll(".dice-btn").forEach((el) => {
      const isTarget =
        targetCard &&
        targetCard !== dragState.sourceCard &&
        parseInt(targetCard.dataset.index, 10) !== dragState.index &&
        el === targetCard;
      el.classList.toggle("drag-target", isTarget);
    });
  }

  function endDrag(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    let didReorder = false;

    if (dragState.isDragging) {
      const targetCard = getCardFromPoint(e.clientX, e.clientY);

      if (targetCard) {
        const targetIndex = parseInt(targetCard.dataset.index, 10);
        if (targetIndex !== dragState.index) {
          const movedItem = DiceApp.database[
            DiceApp.currentCharacter
          ].buttons.splice(dragState.index, 1)[0];
          DiceApp.database[DiceApp.currentCharacter].buttons.splice(
            targetIndex,
            0,
            movedItem,
          );
          DiceApp.saveToStorage();
          didReorder = true;
        }
      }

      dragState.sourceCard.style.pointerEvents = "";
      dragState.sourceCard.classList.remove("dragging");
      grid
        .querySelectorAll(".dice-btn")
        .forEach((el) => el.classList.remove("drag-target"));

      if (dragState.sourceCard.hasPointerCapture(e.pointerId)) {
        dragState.sourceCard.releasePointerCapture(e.pointerId);
      }
    }

    if (didReorder) onReorder();
    dragState = null;
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
};

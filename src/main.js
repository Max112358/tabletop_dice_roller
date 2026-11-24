import "./state.js";
import "./utils.js";
import "./visuals.js";
import "./dragAndDrop.js";
import "./io.js";
import "./app.js";
import "./rollController.js";
import "./ui.js";
import "./editModal.js";

(async function init() {
  await DiceApp.loadDatabase();
  DiceApp.setupVariableDragAndDrop(DiceApp.renderUI);
  DiceApp.setupButtonDragAndDrop(DiceApp.renderUI);
  DiceApp.renderUI();
})();

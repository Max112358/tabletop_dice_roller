export const MODAL_HTML = `
<div id="formula-builder-modal" class="modal-overlay modal-hidden">
  <div class="modal-content builder-modal-content" onclick="event.stopPropagation()">
    <span class="modal-close" onclick="closeModal('formula-builder-modal')">&times;</span>
    <h3>Build Formula</h3>

    <label style="display:block; margin-top:10px;">Label</label>
    <input type="text" id="builder-label" style="width:100%" />

    <label style="display:block; margin-top:10px;">Note</label>
    <input type="text" id="builder-note" style="width:100%" />

    <div style="margin-top:10px; color:#a6adc8; font-size:12px;">
      Display: <span id="builder-display"></span>
    </div>

    <div class="formula-builder-body">
      <div class="builder-palette" id="builder-palette"></div>
      <div class="builder-workspace-container">
        <div class="builder-workspace" id="builder-workspace"></div>
        <div class="builder-properties" id="builder-properties">
          Drag a node type onto the line above.
        </div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-top:15px;">
      <button id="builder-preview" type="button">Preview Roll</button>
      <button id="builder-save" type="button">Save</button>
      <button class="danger" onclick="closeModal('formula-builder-modal')" type="button">Cancel</button>
    </div>

    <pre id="builder-preview-output" style="margin-top:10px; font-size:12px; white-space:pre-wrap;"></pre>
  </div>
</div>
`;

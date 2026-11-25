export const PAGE_HTML = `
<div id="formula-builder-page" class="builder-page hidden">
  <div class="builder-page-header">
    <h3>Build Formula</h3>
    <div class="builder-page-actions">
      <button id="builder-save" type="button">Save</button>
      <button id="builder-cancel" class="danger" type="button">Cancel</button>
    </div>
  </div>

  <div class="builder-page-form">
    <label>Label</label>
    <input type="text" id="builder-label" />

    <label class="builder-form-note">Note</label>
    <input type="text" id="builder-note" class="builder-form-note" />
  </div>

  <div class="builder-page-display">
    Display: <span id="builder-display"></span>
  </div>

  <div class="builder-page-body">
    <div class="builder-palette" id="builder-palette"></div>
    <div class="builder-workspace" id="builder-workspace"></div>
  </div>

  <div class="builder-page-properties" id="builder-properties">
    Drag a node type onto the workspace above.
  </div>

  <div class="builder-json-io">
    <label>Formula JSON</label>
    <textarea id="builder-json-output" rows="6" placeholder="Paste JSON here or click Export to copy..."></textarea>
    <div class="builder-json-actions">
      <button id="builder-export" type="button">Export</button>
      <button id="builder-import" type="button">Import</button>
    </div>
  </div>
</div>
`;

// Core database state architecture updated to support custom variable schema objects per profile
let database = JSON.parse(localStorage.getItem('dice_profiles_v2')) || {
    "Example Paladin": {
        buttons: [
            { label: "Longsword (Advantage)", formula: "2d20kh1+STR+PROF", note: "To Hit" },
            { label: "Longsword Damage", formula: "1d8+STR", note: "Slashing" },
            { label: "Divine Smite (2nd Level)", formula: "3d8", note: "Radiant Damage" },
            { label: "Daggerheart Action", formula: "2d12daggerheart+STR", note: "Hope vs Fear" }
        ],
        variables: { "STR": 4, "PROF": 3 }
    }
};

// Fallback cleanup migration helper for old localstorage profiles data if found
if(localStorage.getItem('dice_profiles') && !localStorage.getItem('dice_profiles_v2')) {
    try {
        let oldDb = JSON.parse(localStorage.getItem('dice_profiles'));
        Object.keys(oldDb).forEach(charKey => {
            if(Array.isArray(oldDb[charKey])) {
                database[charKey] = { buttons: oldDb[charKey], variables: {} };
            }
        });
    } catch(e){}
}

let currentCharacter = localStorage.getItem('current_dice_char') || Object.keys(database)[0] || "Example Paladin";
ensureCharacterStructure(currentCharacter);

function ensureCharacterStructure(charName) {
    if (!database[charName]) database[charName] = { buttons: [], variables: {} };
    if (!database[charName].buttons) database[charName].buttons = [];
    if (!database[charName].variables) database[charName].variables = {};
}

// Rolling Buffer State Variables
let rollBuffer = [];
let lastRollTime = 0;
const COMBO_TIMEOUT_MS = 10000; // 10 seconds tracking limit
let draggedIndex = null; // Drag and drop helper tracking state for buttons
let draggedVarName = null; // Drag and drop helper tracking state for variables

// --- FORMULA VARIABLE VALIDATION CHECKER ---
function getMissingVariables(formula) {
    let cleanFormula = formula.replace(/\s+/g, '').toLowerCase();
    
    // Strip the special custom keyword prefix out so it does not trigger a false-missing alert
    if (cleanFormula.startsWith('2d12daggerheart')) {
        cleanFormula = cleanFormula.substring(15);
    }

    const activeVars = database[currentCharacter].variables || {};
    const wordMatches = cleanFormula.match(/\b[a-z_][a-z0-9_]*\b/g) || [];
    const missing = [];

    const reservedKeywords = ['d', 'kh', 'kl'];

    for (let word of wordMatches) {
        if (reservedKeywords.includes(word)) continue;
		// If it's a pure number inside a match boundary, skip it
        if (!isNaN(word)) continue; 

		// Check if our uppercase variable bank contains this word
        const matchedVar = Object.keys(activeVars).find(v => v.toLowerCase() === word);
        if (!matchedVar && !missing.includes(word.toUpperCase())) {
            missing.push(word.toUpperCase());
        }
    }
    return missing;
}

// --- CORE DICE ROLL SIMULATOR ---
function rollBasicDice(countStr, sidesStr) {
    const count = countStr ? parseInt(countStr) : 1;
    const sides = parseInt(sidesStr);
    let rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    return {
        total: rolls.reduce((a, b) => a + b, 0),
        breakdown: rolls
    };
}

function evaluateSimpleExpression(expr, detailedRolls) {
    const diceRegex = /(\d*)d(\d+)(kh|kl)?(\d*)/g;
    
    return expr.replace(diceRegex, (match, countStr, sidesStr, mod, keepStr) => {
        const count = countStr ? parseInt(countStr) : 1;
        const sides = parseInt(sidesStr);
        const roll = rollBasicDice(count, sides);

        const formatRoll = (val) => {
            if (sides === 20 && (val === 1 || val === 20)) {
                return `Natural ${val}`;
            }
            return val;
        };

        if (mod) {
            const keepCount = keepStr ? parseInt(keepStr) : 1;
            let indexed = roll.breakdown.map((val, idx) => ({ val, idx }));
            
            if (mod === "kh") indexed.sort((a, b) => b.val - a.val);
            else indexed.sort((a, b) => a.val - b.val);

            let keptIndices = indexed.slice(0, keepCount).map(item => item.idx);
            let keptRolls = [];
            let droppedRolls = [];

            roll.breakdown.forEach((val, idx) => {
                let formattedVal = formatRoll(val);
                if (keptIndices.includes(idx)) {
                    keptRolls.push(formattedVal);
                } else {
                    droppedRolls.push(formattedVal);
                }
            });

            let allRollsStr = roll.breakdown.map(formatRoll).join(' OR ');
            let stringBreakdown = `${allRollsStr} -> Kept: ${keptRolls.join(', ')}`;

            detailedRolls.push(`${count}d${sides}${mod}${keepCount} (${stringBreakdown})`);
            let keptSum = indexed.slice(0, keepCount).reduce((sum, item) => sum + item.val, 0);
            return `(${keptSum})`;
        } else {
            let formattedBreakdown = roll.breakdown.map(formatRoll).join('+');
            detailedRolls.push(`${count}d${sides} (${formattedBreakdown})`);
            return `(${roll.total})`;
        }
    });
}

// --- COMPREHENSIVE ADVANCED PARSING ENGINE ---
function parseAndRoll(formula) {
    let cleanFormula = formula.replace(/\s+/g, '').toLowerCase();
    
    // VARIABLE INJECTION INTERCEPTOR
    const activeVars = database[currentCharacter].variables || {};
    const sortedVarNames = Object.keys(activeVars).sort((a, b) => b.length - a.length);
    
    for (let varName of sortedVarNames) {
        const lowerVarName = varName.toLowerCase();
        const value = activeVars[varName];
        const varRegex = new RegExp(`\\b${lowerVarName}\\b`, 'g');
        cleanFormula = cleanFormula.replace(varRegex, `(${value})`);
    }

    // --- SPECIAL CASE INTERCEPTOR: DAGGERHEART DUAL D12 ---
    if (cleanFormula.includes('2d12daggerheart')) {
        // 1. Roll the core Daggerheart dice
        const hopeDie = Math.floor(Math.random() * 12) + 1;
        const fearDie = Math.floor(Math.random() * 12) + 1;
        const diceTotal = hopeDie + fearDie;

        // 2. Determine the narrative/resource outcome rule
        let outcomeType = "";
        if (hopeDie === fearDie) {
            outcomeType = "CRITICAL SUCCESS! ✨";
        } else if (hopeDie > fearDie) {
            outcomeType = "Roll with HOPE ☀️";
        } else {
            outcomeType = "Roll with FEAR 🌙";
        }

        // 3. Swap out "2d12daggerheart" keyword for the numerical sum of the two dice
        // This preserves any trailing '+1d6' or '+STR' so the rest of the engine can evaluate it!
        let mathFormula = cleanFormula.replace('2d12daggerheart', `(${diceTotal})`);

        // 4. Run the newly modified formula through the main evaluation engine to capture extra dice/modifiers
        let extraDiceLogs = [];
        mathFormula = evaluateSimpleExpression(mathFormula, extraDiceLogs);

        let finalTotal;
        try {
            finalTotal = Function(`"use strict"; return (${mathFormula})`)();
        } catch (e) {
            return null;
        }

        // 5. Build a clear breakdown that shows the Daggerheart core AND any extra additions
        let detailedMessage = `[Hope: ${hopeDie} | Fear: ${fearDie}] -> ${outcomeType}`;
        if (extraDiceLogs.length > 0) {
            detailedMessage += ` (Modifiers: ${extraDiceLogs.join(', ')})`;
        }

        return {
            total: finalTotal,
            breakdown: detailedMessage
        };
    }

    let detailedRolls = [];
    const groupRegex = /(\d+)\*\(([^)]+)\)(kh|kl)(\d+)/g;

    cleanFormula = cleanFormula.replace(groupRegex, (match, setsStr, innerExpr, mod, keepStr) => {
        const totalSets = parseInt(setsStr);
        const keepCount = parseInt(keepStr);
        let simulatedSets = [];

        for (let i = 0; i < totalSets; i++) {
            let setRollLogs = [];
            let substitutedExpr = evaluateSimpleExpression(innerExpr, setRollLogs);
            
            let setTotal;
            try {
                setTotal = Function(`"use strict"; return (${substitutedExpr})`)();
            } catch (e) {
                setTotal = 0;
            }
            simulatedSets.push({ total: setTotal, log: setRollLogs.join(', ') });
        }

        let indexedSets = simulatedSets.map((set, idx) => ({ set, idx }));
        if (mod === "kh") {
            indexedSets.sort((a, b) => b.set.total - a.set.total);
        } else {
            indexedSets.sort((a, b) => a.set.total - b.set.total);
        }

        let keptIndices = indexedSets.slice(0, keepCount).map(item => item.idx);
        let breakdownStrings = simulatedSets.map((set, idx) => {
            return keptIndices.includes(idx) ? `[${set.log} = ${set.total}]` : `~~[${set.log} = ${set.total}]~~`;
        });

        detailedRolls.push(`${totalSets}*(${innerExpr})${mod}${keepCount} (${breakdownStrings.join(' vs ')})`);
        let finalGroupSum = indexedSets.slice(0, keepCount).reduce((sum, item) => sum + item.set.total, 0);
        return `(${finalGroupSum})`;
    });

    cleanFormula = evaluateSimpleExpression(cleanFormula, detailedRolls);

    let finalResult;
    try {
        finalResult = Function(`"use strict"; return (${cleanFormula})`)();
    } catch (e) {
        return null;
    }

    return { total: finalResult, breakdown: detailedRolls.join(', ') };
}

function executeRoll(label, formula, note, buttonElement) {
	// Alert stop blocker if execution is attempted on an invalid config card setup
    const missing = getMissingVariables(formula);
    if (missing.length > 0) {
        showStatus(`Cannot roll! Missing variables: ${missing.join(', ')}`, true);
        return;
    }

    const currentTime = Date.now();
    const rollData = parseAndRoll(formula);
    
    if (!rollData || isNaN(rollData.total)) {
        showStatus("Error evaluating math or dice formula! Check syntax.", true);
        return;
    }

    let singleLineOutput = `*rolls ${label} (${formula}):* **${rollData.total}**`;
    if (rollData.breakdown) singleLineOutput += ` [Details: ${rollData.breakdown}]`;
    if (note) singleLineOutput += ` *(${note})*`;

    if (currentTime - lastRollTime > COMBO_TIMEOUT_MS) {
        rollBuffer = [];
    }
    
    rollBuffer.push(singleLineOutput);
    lastRollTime = currentTime;

    const combinedOutputText = rollBuffer.join('\n');

    navigator.clipboard.writeText(combinedOutputText).then(() => {
        showStatus(rollBuffer.length > 1 ? `Combined sequence copy active (${rollBuffer.length} rolls)!` : `Copied roll for ${label}!`);
        
        document.getElementById('resTitle').innerHTML = `Active Stack: <strong>${rollBuffer.length} Roll(s)</strong>`;
        document.getElementById('resRaw').innerText = combinedOutputText;

        const timerBadge = document.getElementById('bufferTimer');
        timerBadge.style.display = 'inline-block';
        timerBadge.innerText = `Combo active: +10s added`;

        if(buttonElement) {
            const originalText = buttonElement.innerText;
            buttonElement.innerText = "✓ Added!";
            buttonElement.classList.add('success-flash');
            
            setTimeout(() => {
                buttonElement.innerText = originalText;
                buttonElement.classList.remove('success-flash');
            }, 600);
        }
    }).catch(err => {
        showStatus("Clipboard execution error!", true);
    });
}

// Auto-cleanup timer window update loop
setInterval(() => {
    if (rollBuffer.length > 0) {
        const timePassed = Date.now() - lastRollTime;
        const timerBadge = document.getElementById('bufferTimer');
        
        if (timePassed > COMBO_TIMEOUT_MS) {
            timerBadge.style.display = 'none';
            document.getElementById('resTitle').innerHTML = `Stack Expired <span style="font-size:12px; font-weight:normal; color:#a6adc8;">(Next click resets)</span>`;
        } else {
            const remainingSeconds = ((COMBO_TIMEOUT_MS - timePassed) / 1000).toFixed(1);
            timerBadge.innerText = `Combo Window: ${remainingSeconds}s`;
        }
    }
}, 200);

// --- UI & STATE MANAGEMENT ---
function saveToStorage() {
    localStorage.setItem('dice_profiles_v2', JSON.stringify(database));
    localStorage.setItem('current_dice_char', currentCharacter);
}

function renderUI() {
    ensureCharacterStructure(currentCharacter);

    // 1. Render Character Selection List
    const select = document.getElementById('charSelect');
    select.innerHTML = '';
    Object.keys(database).forEach(char => {
        const opt = document.createElement('option');
        opt.value = char;
        opt.innerText = char;
        if (char === currentCharacter) opt.selected = true;
        select.appendChild(opt);
    });

    // 2. Render Variables Dashboard
    const varContainer = document.getElementById('varContainer');
    varContainer.innerHTML = '';
    const variables = database[currentCharacter].variables || {};
    
    Object.keys(variables).forEach(varName => {
        const badge = document.createElement('div');
        badge.className = 'var-badge';
        badge.setAttribute('draggable', true);
        badge.style.cursor = 'grab';
        
		// Drag events for variables
        badge.ondragstart = function(e) {
            draggedVarName = varName;
            this.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        };
        badge.ondragend = function() {
            this.style.opacity = '1';
            draggedVarName = null;
            document.querySelectorAll('.var-badge').forEach(el => el.style.border = '1px solid #45475a');
        };
        badge.ondragover = function(e) { e.preventDefault(); return false; };
        badge.ondragenter = function(e) {
            const targetBadge = e.target.closest('.var-badge');
            if (targetBadge && varName !== draggedVarName) targetBadge.style.border = '1px dashed #89b4fa';
        };
        badge.ondragleave = function(e) {
            const relatedTargetBadge = e.relatedTarget ? e.relatedTarget.closest('.var-badge') : null;
            if (relatedTargetBadge !== this) this.style.border = '1px solid #45475a';
        };
        badge.ondrop = function(e) {
            e.preventDefault();
            this.style.border = '1px solid #45475a';
            if (draggedVarName !== null && draggedVarName !== varName) {
                const varKeys = Object.keys(variables);
                const sourceIndex = varKeys.indexOf(draggedVarName);
                const targetIndex = varKeys.indexOf(varName);

                if (sourceIndex !== -1 && targetIndex !== -1) {
                    varKeys.splice(sourceIndex, 1);
                    varKeys.splice(targetIndex, 0, draggedVarName);


					// Rebuild variables schema configuration state order maps
                    const newVariables = {};
                    varKeys.forEach(k => {
                        newVariables[k] = variables[k];
                    });

                    database[currentCharacter].variables = newVariables;
                    saveToStorage();
                    renderUI();
                }
            }
        };

        const label = document.createElement('span');
        label.className = 'var-name';
        label.innerText = varName;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'var-val-input';
        input.value = variables[varName];
        input.setAttribute('draggable', false);
        input.onchange = function() {
            updateVariableValue(varName, this.value);
        };
        
        const delBtn = document.createElement('button');
        delBtn.className = 'var-del-btn';
        delBtn.innerHTML = '✕';
        delBtn.title = `Delete variable ${varName}`;
        delBtn.setAttribute('draggable', false);
        delBtn.onclick = function(e) {
            e.stopPropagation();
            removeVariable(varName);
        };
        
        badge.appendChild(label);
        badge.appendChild(input);
        badge.appendChild(delBtn);
        varContainer.appendChild(badge);
    });

    // 3. Render Dice Action Grid Buttons
    const grid = document.getElementById('diceGrid');
    grid.innerHTML = '';
    const buttons = database[currentCharacter].buttons || [];
    
    buttons.forEach((btn, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'dice-btn';
        wrapper.setAttribute('draggable', true);
        wrapper.style.cursor = 'grab';
        
        const missingVars = getMissingVariables(btn.formula);
        if (missingVars.length > 0) {
            wrapper.classList.add('broken');
        }

        wrapper.ondragstart = function(e) {
            draggedIndex = index;
            this.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        };
        wrapper.ondragend = function() {
            this.style.opacity = '1';
            draggedIndex = null;
            document.querySelectorAll('.dice-btn').forEach(el => el.style.border = 'none');
        };
        wrapper.ondragover = function(e) { e.preventDefault(); return false; };
        wrapper.ondragenter = function(e) {
            const targetCard = e.target.closest('.dice-btn');
            if (targetCard && index !== draggedIndex) targetCard.style.border = '1px dashed #89b4fa';
        };
        wrapper.ondragleave = function(e) {
            const relatedTargetCard = e.relatedTarget ? e.relatedTarget.closest('.dice-btn') : null;
            if (relatedTargetCard !== this) this.style.border = 'none';
        };
        wrapper.ondrop = function(e) {
            e.preventDefault();
            this.style.border = 'none';
            if (draggedIndex !== null && draggedIndex !== index) {
                const movedItem = database[currentCharacter].buttons.splice(draggedIndex, 1)[0];
                database[currentCharacter].buttons.splice(index, 0, movedItem);
                saveToStorage();
                renderUI();
            }
        };
        
        const rollBtn = document.createElement('button');
        rollBtn.style.width = '100%';
        rollBtn.style.whiteSpace = 'pre-line';
        rollBtn.style.cursor = 'pointer';
        rollBtn.innerText = `${btn.label}\n(${btn.formula})`;
        rollBtn.onclick = function() { executeRoll(btn.label, btn.formula, btn.note, this); };
        rollBtn.setAttribute('draggable', false);

        const errorBadge = document.createElement('div');
        errorBadge.className = 'error-badge';
        errorBadge.innerText = `⚠️ Missing: ${missingVars.join(', ')}`;

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-corner-btn';
        delBtn.innerText = '✕';
        delBtn.title = `Delete ${btn.label}`;
        delBtn.setAttribute('draggable', false);
        delBtn.onclick = (e) => { 
            e.stopPropagation();
            removeButton(index, btn.label);
        };

        wrapper.appendChild(rollBtn);
        wrapper.appendChild(errorBadge);
        wrapper.appendChild(delBtn);
        grid.appendChild(wrapper);
    });
}

// --- VARIABLE MANAGEMENT SUB-ROUTINES ---
function addVariable() {
    const nameInput = document.getElementById('newVarName');
    const valInput = document.getElementById('newVarValue');
    
    const rawName = nameInput.value.trim().toUpperCase();
    const cleanName = rawName.replace(/[^A-Z]/g, '');
    const value = parseInt(valInput.value);

    if (!cleanName) {
        showStatus("Variable label must contain uppercase alphabetic characters!", true);
        return;
    }
    if (isNaN(value)) {
        showStatus("Variable value must be a valid integer number.", true);
        return;
    }
    if (['d', 'kh', 'kl'].includes(cleanName.toLowerCase())) {
        showStatus(`"${cleanName}" is a reserved syntax key word.`, true);
        return;
    }

    database[currentCharacter].variables[cleanName] = value;
    saveToStorage();
    renderUI();

    nameInput.value = '';
    valInput.value = '';
    showStatus(`Variable "${cleanName}" added!`);
}

function updateVariableValue(name, val) {
    const cleanVal = parseInt(val);
    database[currentCharacter].variables[name] = isNaN(cleanVal) ? 0 : cleanVal;
    saveToStorage();
    renderUI();
    showStatus(`Updated variable "${name}" to ${database[currentCharacter].variables[name]}`);
}

function removeVariable(name) {
    if (confirm(`Delete character variable "${name}"?`)) {
        delete database[currentCharacter].variables[name];
        saveToStorage();
        renderUI();
        showStatus(`Deleted variable "${name}".`);
    }
}

// --- GENERAL MANAGEMENT ---
function switchCharacter() {
    currentCharacter = document.getElementById('charSelect').value;
    saveToStorage();
    renderUI();
    rollBuffer = [];
    document.getElementById('resTitle').innerText = "No dice rolled yet...";
    document.getElementById('resRaw').innerText = "Click a custom action button above to calculate a formula string.";
    document.getElementById('bufferTimer').style.display = 'none';
}

function createCharacter() {
    const name = document.getElementById('newCharName').value.trim();
    if (!name) return;
    if (!database[name]) database[name] = { buttons: [], variables: {} };
    currentCharacter = name;
    document.getElementById('newCharName').value = '';
    saveToStorage();
    renderUI();
}

function deleteCharacter() {
    if (confirm(`Are you sure you want to delete all profiles/buttons for ${currentCharacter}?`)) {
        delete database[currentCharacter];
        const remaining = Object.keys(database);
        currentCharacter = remaining.length ? remaining[0] : "Example Paladin";
        ensureCharacterStructure(currentCharacter);
        saveToStorage();
        renderUI();
    }
}

function addButton() {
    const label = document.getElementById('btnLabel').value.trim();
    const formula = document.getElementById('btnFormula').value.trim();
    const note = document.getElementById('btnNote').value.trim();

    if (!label || !formula) {
        showStatus("Label and Formula are required!", true);
        return;
    }

    database[currentCharacter].buttons.push({ label, formula, note });
    saveToStorage();
    renderUI();

    document.getElementById('btnLabel').value = '';
    document.getElementById('btnFormula').value = '';
    document.getElementById('btnNote').value = '';
}

function removeButton(index, label) {
    if (confirm(`Delete the "${label}" macro button?`)) {
        database[currentCharacter].buttons.splice(index, 1);
        saveToStorage();
        renderUI();
        showStatus(`Deleted "${label}" macro.`);
    }
}

// --- DATA IMPORT / EXPORT DATA LOGIC ---
function exportCharacter() {
    ensureCharacterStructure(currentCharacter);
    const exportPack = { 
        characterName: currentCharacter, 
        buttons: database[currentCharacter].buttons,
        variables: database[currentCharacter].variables
    };
    document.getElementById('ioJson').value = JSON.stringify(exportPack);
    showStatus("JSON package generated! Copy it from the text block below.");
}

function importCharacter() {
    const rawJson = document.getElementById('ioJson').value.trim();
    try {
        const parsed = JSON.parse(rawJson);
        if (parsed.characterName && Array.isArray(parsed.buttons)) {
            database[parsed.characterName] = {
                buttons: parsed.buttons,
                variables: parsed.variables || {}
            };
            currentCharacter = parsed.characterName;
            saveToStorage();
            renderUI();
            showStatus(`Successfully imported ${parsed.characterName} with variables!`);
            document.getElementById('ioJson').value = '';
        } else {
            showStatus("Invalid JSON structure format.", true);
        }
    } catch (e) {
        showStatus("Failed to parse JSON string config pack.", true);
    }
}

function showStatus(msg, isError = false) {
    const el = document.getElementById('status');
    el.style.color = isError ? '#f38ba8' : '#a6e3a1';
    el.innerText = msg;
    setTimeout(() => { el.innerText = ''; }, 4000);
}

// Initialize on execution
renderUI();
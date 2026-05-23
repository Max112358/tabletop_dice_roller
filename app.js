// Core database state architecture updated to support custom variable schema objects per profile
let database = JSON.parse(localStorage.getItem('dice_profiles_v2')) || {
    "Example Paladin": {
        buttons: [
            { label: "Longsword (Advantage)", formula: "2d20kh1+[STR]+[PROF]", note: "To Hit" },
            { label: "Longsword Damage", formula: "1d8+[STR]", note: "Slashing" },
            { label: "Variable Swarm", formula: "[STR]d[PROF]", note: "Dynamic Engine Test!" },
            { label: "Divine Smite (2nd Level)", formula: "3d8", note: "Radiant Damage" },
            { label: "Daggerheart Action", formula: "2d12daggerheart+[STR]", note: "Hope vs Fear" }
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
    ensureCharacterStructure(currentCharacter);
    const activeVars = database[currentCharacter].variables || {};
    // Keep keys exactly as they are defined for accurate mapping
    const lowerVars = Object.keys(activeVars).map(v => v.toLowerCase());
    
    let missing = [];
    // Extract everything enclosed cleanly in square brackets
    const bracketRegex = /\[([^\]]+)\]/g;
    let match;

    while ((match = bracketRegex.exec(formula)) !== null) {
        let varName = match[1].trim().toLowerCase();
        if (!lowerVars.includes(varName)) {
            missing.push(match[1].trim());
        }
    }
    return missing;
}

// =========================================================================
// REFACTORED DICE PIPELINE ENGINE (FIXED)
// =========================================================================

function parseAndRoll(label, formula) {
    try {
        ensureCharacterStructure(currentCharacter);
        let activeVars = database[currentCharacter].variables || {};
        
        let workingFormula = formula.trim().toLowerCase();
        const displayFormula = formula;

        let breakdownLogs = [];
        let daggerheartContext = null;

        // -----------------------------------------------------------------
        // STEP 1: VARIABLE SUBSTITUTION (Square Brackets)
        // -----------------------------------------------------------------
        const bracketRegex = /\[([^\]]+)\]/g;
        let hasMissingVar = false;
        let missingVarName = "";

        workingFormula = workingFormula.replace(bracketRegex, (fullMatch, varName) => {
            let foundKey = Object.keys(activeVars).find(k => k.toLowerCase() === varName.trim());
            
            if (foundKey !== undefined) {
                return activeVars[foundKey];
            } else {
                hasMissingVar = true;
                missingVarName = varName.toUpperCase();
                return fullMatch;
            }
        });

        if (hasMissingVar) {
            throw new Error(`Missing variable reference: [${missingVarName}]`);
        }

        // -----------------------------------------------------------------
        // STEP 2: LEFT-TO-RIGHT DICE EVALUATION LOOP
        // -----------------------------------------------------------------
        // Updated regex supports: 
        // Normal (2d12), standard keep (4d12kh2), daggerheart, 
        // AND Pool Matching notation: 2d12p2kh1 (Pool 2 times, keep highest 1)
        const diceRegex = /(\d+)d(\d+)(p\d+kh\d+|p\d+kl\d+|kh\d+|kl\d+|daggerheart)?/;

        while (diceRegex.test(workingFormula)) {
            let matchInstance = workingFormula.match(diceRegex);
            let fullDiceExpression = matchInstance[0];
            let count = parseInt(matchInstance[1], 10);
            let sides = parseInt(matchInstance[2], 10);
            let modifier = matchInstance[3] || "";

            let evaluatedNumericValue = 0;
            let logString = "";

            // 1. Daggerheart Interceptor
            if (modifier === "daggerheart") {
                let hopeRoll = Math.floor(Math.random() * sides) + 1;
                let fearRoll = Math.floor(Math.random() * sides) + 1;
                evaluatedNumericValue = hopeRoll + fearRoll;
                
                let outcome = hopeRoll === fearRoll ? "CRITICAL SUCCESS! ✨" : 
                              (hopeRoll > fearRoll ? "Roll with HOPE ☀️" : "Roll with FEAR 🌙");
                
                daggerheartContext = `[Hope: ${hopeRoll} | Fear: ${fearRoll}] -> ${outcome}`;
                logString = `${fullDiceExpression} (${hopeRoll} hope, ${fearRoll} fear)`;
            } 
            // 2. Pool Matching Syntax (e.g., 2d12p2kh1 -> Pool 2 times, keep highest 1)
            else if (modifier.startsWith("p") && (modifier.includes("kh") || modifier.includes("kl"))) {
                let isHighest = modifier.includes("kh");
                
                // Parse out the pool iterations and keep count using regex groups
                // modifier looks like: p2kh1 or p3kl1
                let poolMatch = modifier.match(/p(\d+)(kh|kl)(\d+)/);
                let poolIterations = parseInt(poolMatch[1], 10);
                let keepCount = parseInt(poolMatch[3], 10);

                let poolTotals = [];
                let poolDetails = [];

                // Execute the full pool roll iterations separately
                for (let i = 0; i < poolIterations; i++) {
                    let currentIterationRolls = [];
                    for (let j = 0; j < count; j++) {
                        currentIterationRolls.push(Math.floor(Math.random() * sides) + 1);
                    }
                    let currentIterationTotal = currentIterationRolls.reduce((sum, val) => sum + val, 0);
                    poolTotals.push(currentIterationTotal);
                    poolDetails.push(`[${currentIterationRolls.join('+')} = ${currentIterationTotal}]`);
                }

                // Sort the totals to keep the highest or lowest pools
                let keptPools = [];
                if (isHighest) {
                    // Sort descending for keep highest
                    keptPools = [...poolTotals].sort((a, b) => b - a).slice(0, keepCount);
                    logString = `${count}d${sides} Pool Sets: { ${poolDetails.join(' vs ')} } -> Kept Highest ${keepCount}: (${keptPools.join('+')})`;
                } else {
                    // Sort ascending for keep lowest
                    keptPools = [...poolTotals].sort((a, b) => a - b).slice(0, keepCount);
                    logString = `${count}d${sides} Pool Sets: { ${poolDetails.join(' vs ')} } -> Kept Lowest ${keepCount}: (${keptPools.join('+')})`;
                }

                evaluatedNumericValue = keptPools.reduce((sum, val) => sum + val, 0);
            }
            // 3. Standard Keep Highest Modifiers (e.g., 4d12kh2)
            else if (modifier.startsWith("kh")) {
                let keepCount = parseInt(modifier.replace("kh", ""), 10);
                let rolls = [];
                for (let i = 0; i < count; i++) { rolls.push(Math.floor(Math.random() * sides) + 1); }
                let kept = [...rolls].sort((a, b) => b - a).slice(0, keepCount);
                evaluatedNumericValue = kept.reduce((sum, val) => sum + val, 0);
                logString = `${fullDiceExpression} [Rolls: ${rolls.join(', ')}] Kept: (${kept.join('+')})`;
            } 
            // 4. Standard Keep Lowest Modifiers (e.g., 4d12kl2)
            else if (modifier.startsWith("kl")) {
                let keepCount = parseInt(modifier.replace("kl", ""), 10);
                let rolls = [];
                for (let i = 0; i < count; i++) { rolls.push(Math.floor(Math.random() * sides) + 1); }
                let kept = [...rolls].sort((a, b) => a - b).slice(0, keepCount);
                evaluatedNumericValue = kept.reduce((sum, val) => sum + val, 0);
                logString = `${fullDiceExpression} [Rolls: ${rolls.join(', ')}] Kept: (${kept.join('+')})`;
            } 
            // 5. Plain Vanilla Dice Roll
            else {
                let rolls = [];
                for (let i = 0; i < count; i++) { rolls.push(Math.floor(Math.random() * sides) + 1); }
                evaluatedNumericValue = rolls.reduce((sum, val) => sum + val, 0);
                logString = `${fullDiceExpression} (${rolls.join('+')}=${evaluatedNumericValue})`;
            }

            breakdownLogs.push(logString);
            workingFormula = workingFormula.replace(fullDiceExpression, evaluatedNumericValue);
        }

        // -----------------------------------------------------------------
        // STEP 3: STANDARD PEMDAS MATHEMATICS EVALUATION
        // -----------------------------------------------------------------
        workingFormula = workingFormula.replace(/\s+/g, '');

        if (/[^0-9\+\-\*\/\(\)\.]/.test(workingFormula)) {
            throw new Error("Syntax Error: Unexpected math operator configuration remaining.");
        }

        let finalResultTotal = Function(`"use strict"; return (${workingFormula})`)();

        // Return data payload structured back to execution buffer coordinator
        return {
            total: finalResultTotal,
            breakdown: breakdownLogs.length > 0 ? breakdownLogs.join(' -> ') : null,
            dhContext: daggerheartContext
        };

    } catch (error) {
        console.error(error);
        showStatus(error.message || "Error evaluating math formula structure!", true);
        return null;
    }
}

function executeRoll(label, formula, note, buttonElement) {
    const missing = getMissingVariables(formula);
    if (missing.length > 0) {
        showStatus(`Cannot roll! Missing variables: ${missing.join(', ')}`, true);
        return;
    }

    const currentTime = Date.now();
    // Pass both label and formula to parseAndRoll
    const rollData = parseAndRoll(label, formula);
    
    if (!rollData || isNaN(rollData.total)) {
        showStatus("Error evaluating math or dice formula! Check syntax.", true);
        return;
    }

    // Format single roll line strings cleanly
    let singleLineOutput = `*rolls ${label} (${formula}):* **${rollData.total}**`;
    if (rollData.dhContext) singleLineOutput += ` ${rollData.dhContext}`;
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
const canvas = document.getElementById('certificateCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const editOverlay = document.getElementById('editOverlay');

let backgroundImage = null;
let modifiedBackground = null;
let textElements = [];
let imageElements = [];
let selectedElement = null;
let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };
let editingPosition = null;
let brushStrokes = [];
let currentMode = 'move';
let zoomLevel = 1;
let signatures = [];
let selectedSignature = null;

let isBrushing = false;
let lastBrushX = 0;
let lastBrushY = 0;
let sampledColor = '#ffffff';
let colorSampled = false;

const variableFieldsContainer = document.getElementById('variableFieldsContainer');

// Notification system
// --- Sidebar Editing UI ---
function updateSidebarForSelection() {
    try {
        const textInput = document.getElementById('textContent');
        const fontFamilyInput = document.getElementById('fontFamily');
        const fontSizeInput = document.getElementById('fontSize');
        const colorInput = document.getElementById('textColor');
        
        if (!textInput || !fontFamilyInput || !fontSizeInput || !colorInput) {
            console.warn('Some sidebar elements not found');
            return;
        }
        
        if (selectedElement && selectedElement.type === 'text') {
            let displayName = selectedElement.isVariable
                ? (selectedElement.text.match(/\{\{(.+?)\}\}/)?.[1] || 'Variable')
                : selectedElement.text;
            
            textInput.value = selectedElement.isVariable ? displayName : selectedElement.text;
            fontFamilyInput.value = selectedElement.fontFamily;
            fontSizeInput.value = selectedElement.fontSize;
            colorInput.value = selectedElement.color;
            
            // Enable delete button
            const deleteBtn = document.getElementById('deleteBtn');
            if (deleteBtn) deleteBtn.disabled = false;
            
            console.log('Sidebar updated for selected element:', displayName);
        } else {
            textInput.value = '';
            fontFamilyInput.value = 'Arial';
            fontSizeInput.value = 24;
            colorInput.value = '#000000';
            
            // Disable delete button
            const deleteBtn = document.getElementById('deleteBtn');
            if (deleteBtn) deleteBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error in updateSidebarForSelection:', error);
    }
}

// Update selected element on sidebar input change
document.getElementById('textContent').addEventListener('input', function() {
    if (selectedElement && selectedElement.type === 'text') {
        if (selectedElement.isVariable) {
            // Update variable name in {{NAME}} format
            let newName = this.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
            if (!newName) newName = 'VARIABLE';
            selectedElement.text = `{{${newName}}}`;
            document.getElementById('selectedNameDisplay').textContent = newName;
            refreshVariableInputs();
        } else {
            selectedElement.text = this.value;
            document.getElementById('selectedNameDisplay').textContent = this.value;
        }
        redraw();
    }
});
document.getElementById('fontFamily').addEventListener('input', function() {
    if (selectedElement && selectedElement.type === 'text') {
        selectedElement.fontFamily = this.value;
        redraw();
    }
});
document.getElementById('fontSize').addEventListener('input', function() {
    if (selectedElement && selectedElement.type === 'text') {
        selectedElement.fontSize = parseInt(this.value);
        redraw();
    }
});
document.getElementById('textColor').addEventListener('input', function() {
    if (selectedElement && selectedElement.type === 'text') {
        selectedElement.color = this.value;
        redraw();
    }
});
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function refreshVariableInputs() {
    console.log('refreshVariableInputs called'); // Debug log
    variableFieldsContainer.innerHTML = "";
    const variableNames = [...new Set(textElements.filter(e => e.isVariable).map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1]).filter(Boolean))];
    console.log('Variable names found:', variableNames); // Debug log
    
    if (variableNames.length > 0) {
        const heading = document.createElement('h6');
        heading.textContent = 'Variable Data Entry';
        heading.className = 'mb-3 text-primary';
        variableFieldsContainer.appendChild(heading);

        const table = document.createElement('table');
        table.className = 'variable-table table table-sm table-striped';
        
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th>Row</th>` + variableNames.map(v => `<th>${v}</th>`).join('');
        table.appendChild(headerRow);

        // Start with 1 row initially
        addTableRow(table, variableNames, 0);
        variableFieldsContainer.appendChild(table);
        console.log('Variable table created and added'); // Debug log
    } else {
        console.log('No variables found, table not created'); // Debug log
    }
}

function addTableRow(table, variableNames, rowIndex) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${rowIndex + 1}</td>` + variableNames.map(v => 
        `<td><input type="text" class="form-control form-control-sm" data-var="${v}" data-row="${rowIndex}" oninput="checkAddNewRow()"></td>`
    ).join('');
    table.appendChild(row);
}

function checkAddNewRow() {
    const table = variableFieldsContainer.querySelector('table');
    if (!table) return;

    const inputs = Array.from(table.querySelectorAll('input'));
    const variableNames = [...new Set(textElements.filter(e => e.isVariable).map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1]))];
    
    // Check if last row has any data
    const maxRow = Math.max(...inputs.map(inp => parseInt(inp.dataset.row)));
    const lastRowInputs = inputs.filter(inp => parseInt(inp.dataset.row) === maxRow);
    const lastRowHasData = lastRowInputs.some(inp => inp.value.trim() !== '');

    if (lastRowHasData) {
        addTableRow(table, variableNames, maxRow + 1);
    }
}

// Signature handling
document.getElementById('signatureUpload').addEventListener('change', function(e) {
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const signature = {
                    id: Date.now() + Math.random(),
                    image: img,
                    name: file.name
                };
                signatures.push(signature);
                updateSignatureList();
                showNotification(`Signature "${file.name}" uploaded successfully!`, 'success');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});

function updateSignatureList() {
    const list = document.getElementById('signatureList');
    list.innerHTML = signatures.map(sig => `
        <div class="signature-item ${selectedSignature?.id === sig.id ? 'selected' : ''}" 
                onclick="selectSignature('${sig.id}')" data-id="${sig.id}">
            <img src="${sig.image.src}" alt="${sig.name}">
            <button class="signature-delete" onclick="deleteSignature('${sig.id}', event)">×</button>
        </div>
    `).join('');
    
    if (signatures.length === 0) {
        list.innerHTML = '<p style="color: #666; text-align: center; margin: 10px 0;">No signatures uploaded yet</p>';
    }
}

function selectSignature(id) {
    selectedSignature = signatures.find(sig => sig.id == id);
    updateSignatureList();
    document.getElementById('addSignatureBtn').disabled = !selectedSignature;
}

function deleteSignature(id, event) {
    event.stopPropagation();
    signatures = signatures.filter(sig => sig.id != id);
    if (selectedSignature?.id == id) {
        selectedSignature = null;
        document.getElementById('addSignatureBtn').disabled = true;
    }
    updateSignatureList();
    showNotification('Signature deleted', 'info');
}

function addSignatureToCanvas() {
    if (!selectedSignature) {
        showNotification('Please select a signature first', 'error');
        return;
    }
    
    const element = {
        id: Date.now(),
        type: 'image',
        image: selectedSignature.image,
        x: 100 + imageElements.length * 20,
        y: 100 + imageElements.length * 20,
        width: selectedSignature.image.width / 2,
        height: selectedSignature.image.height / 2,
        originalWidth: selectedSignature.image.width,
        originalHeight: selectedSignature.image.height,
        name: selectedSignature.name
    };

    imageElements.push(element);
    redraw();
    showNotification('Signature added to canvas', 'success');
}

// Zoom functionality
function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.1, 3);
    updateZoom();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.3);
    updateZoom();
}

function resetZoom() {
    zoomLevel = 1;
    updateZoom();
}

function updateZoom() {
    canvas.style.transform = `scale(${zoomLevel})`;
    canvas.style.transformOrigin = 'top left';
    
    // Update container size to accommodate the scaled canvas
    const scaledWidth = canvas.width * zoomLevel;
    const scaledHeight = canvas.height * zoomLevel;
    
    container.style.width = scaledWidth + 'px';
    container.style.height = scaledHeight + 'px';
    
    // Update zoom level display
    document.getElementById('zoomLevel').textContent = Math.round(zoomLevel * 100) + '%';
}

// Mode switching
document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        currentMode = this.value;
        updateCursor();
        document.getElementById('brushControls').style.display = 
            currentMode === 'brush' ? 'block' : 'none';
    });
});

document.getElementById('brushSize').addEventListener('input', function(e) {
    document.getElementById('brushSizeDisplay').textContent = e.target.value + 'px';
});

function updateCursor() {
    if (currentMode === 'brush') {
        canvas.style.cursor = 'crosshair';
    } else if (currentMode === 'edit') {
        canvas.style.cursor = 'text';
    } else {
        canvas.style.cursor = 'default';
    }
}

// Template upload
document.getElementById('templateUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                backgroundImage = img;

                modifiedBackground = document.createElement('canvas');
                modifiedBackground.width = canvas.width;
                modifiedBackground.height = canvas.height;
                const modCtx = modifiedBackground.getContext('2d');
                modCtx.drawImage(img, 0, 0);

                updateZoom();
                redraw();
                showNotification('Template uploaded successfully!', 'success');
                
                // Hide upload card and show manage card
                document.getElementById('templateUploadCard').style.display = 'none';
                document.getElementById('templateManageCard').style.display = 'block';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Remove template function
function removeTemplate() {
    backgroundImage = null;
    modifiedBackground = null;
    textElements = [];
    imageElements = [];
    selectedElement = null;
    brushStrokes = [];
    
    // Reset canvas
    canvas.width = 800;
    canvas.height = 600;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '20px Arial';
    ctx.fillText('Upload a template to get started', 50, 50);
    
    // Show upload card and hide manage card
    document.getElementById('templateUploadCard').style.display = 'block';
    document.getElementById('templateManageCard').style.display = 'none';
    
    // Clear file input
    document.getElementById('templateUpload').value = '';
    
    // Clear variable fields
    refreshVariableInputs();
    updateSidebarForSelection();
    
    showNotification('Template removed successfully!', 'info');
}

// Show help modal function
function showHelpModal() {
    const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
    helpModal.show();
}

// Theme toggle functionality
let isDarkMode = false;

function toggleTheme() {
    isDarkMode = !isDarkMode;
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    if (isDarkMode) {
        body.classList.add('dark-theme');
        themeIcon.className = 'bi bi-sun-fill';
        themeText.textContent = 'Light';
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.remove('dark-theme');
        themeIcon.className = 'bi bi-moon-fill';
        themeText.textContent = 'Dark';
        localStorage.setItem('theme', 'light');
    }
}

// Initialize theme on page load
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        isDarkMode = false; // Set to false so toggleTheme() will make it true
        toggleTheme();
    }
}

// Call initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTheme);

function addText() {
    try {
        console.log('addText function called'); // Debug log
        const text = document.getElementById('textContent').value || 'Sample Text';
        const fontFamily = document.getElementById('fontFamily').value;
        const fontSize = document.getElementById('fontSize').value;
        const color = document.getElementById('textColor').value;

        const element = {
            id: Date.now(),
            type: 'text',
            text: text,
            x: 100 + textElements.length * 20,
            y: 100 + textElements.length * 30,
            fontFamily: fontFamily,
            fontSize: parseInt(fontSize),
            color: color,
            isVariable: false
        };

        console.log('Adding text element:', element); // Debug log
        textElements.push(element);
        selectedElement = element;
        updateSidebarForSelection();
        
        // Force immediate redraw with a small delay to ensure DOM is ready
        setTimeout(() => {
            console.log('Calling redraw from setTimeout'); // Debug log
            redraw();
        }, 10);
        
        showNotification('Text added', 'success');
        console.log('Text element added:', element); // Debug log
    } catch (error) {
        console.error('Error in addText:', error);
        showNotification('Error adding text: ' + error.message, 'error');
    }
}

function addVariable() {
    try {
        console.log('addVariable function called'); // Debug log
        // Use the Sample Text as the variable name, no prompt
        let varName = document.getElementById('textContent').value || 'Sample Text';
        varName = varName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (!varName) varName = 'VARIABLE';

        const fontFamily = document.getElementById('fontFamily').value;
        const fontSize = document.getElementById('fontSize').value;
        const color = document.getElementById('textColor').value;

        const element = {
            id: Date.now(),
            type: 'text',
            text: `{{${varName}}}`,
            x: 150 + textElements.length * 20,
            y: 150 + textElements.length * 30,
            fontFamily: fontFamily,
            fontSize: parseInt(fontSize),
            color: color,
            isVariable: true
        };

        console.log('Adding variable element:', element); // Debug log
        textElements.push(element);
        selectedElement = element;
        updateSidebarForSelection();
        refreshVariableInputs(); // This should create the table
        
        // Force immediate redraw with a small delay to ensure DOM is ready
        setTimeout(() => {
            console.log('Calling redraw from setTimeout in addVariable'); // Debug log
            redraw();
        }, 10);
        
        showNotification(`Variable "${varName}" added`, 'success');
        console.log('Variable element added:', element); // Debug log
        console.log('Variable table should be refreshed'); // Debug log
    } catch (error) {
        console.error('Error in addVariable:', error);
        showNotification('Error adding variable: ' + error.message, 'error');
    }
}

function deleteSelected() {
    if (selectedElement) {
        if (selectedElement.type === 'text') {
            textElements = textElements.filter(el => el.id !== selectedElement.id);
            refreshVariableInputs();
        } else if (selectedElement.type === 'image') {
            imageElements = imageElements.filter(el => el.id !== selectedElement.id);
        }
        selectedElement = null;
        document.getElementById('deleteBtn').disabled = true;
        redraw();
        showNotification('Element deleted', 'info');
    }
}

function redraw() {
    console.log('Redraw called, textElements count:', textElements.length); // Debug log
    
    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (modifiedBackground) {
        ctx.drawImage(modifiedBackground, 0, 0);
    } else if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0);
    } else {
        // If no background, provide a clean white canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw text elements - ensure they're always visible
    textElements.forEach((element, index) => {
        console.log(`Drawing text element ${index}:`, element.text, 'at', element.x, element.y); // Debug log
        
        // Set text properties
        ctx.font = `${element.fontSize}px ${element.fontFamily}`;
        ctx.fillStyle = element.color;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        // Highlight selected element
        if (element === selectedElement) {
            const metrics = ctx.measureText(element.text);
            ctx.save();
            ctx.fillStyle = 'rgba(0, 124, 186, 0.2)';
            ctx.fillRect(element.x - 2, element.y - 2, metrics.width + 4, element.fontSize + 4);
            ctx.restore();
            ctx.fillStyle = element.color; // Restore text color
        }

        // Highlight variables with yellow background
        if (element.isVariable) {
            const metrics = ctx.measureText(element.text);
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(element.x - 2, element.y - 2, metrics.width + 4, element.fontSize + 4);
            ctx.restore();
            ctx.fillStyle = element.color; // Restore text color
        }

        // Draw the actual text
        ctx.fillText(element.text, element.x, element.y);
    });

    // Draw image elements
    imageElements.forEach(element => {
        if (element === selectedElement) {
            ctx.save();
            // Selection highlight
            ctx.fillStyle = 'rgba(0, 124, 186, 0.2)';
            ctx.fillRect(element.x - 4, element.y - 4, element.width + 8, element.height + 8);
            
            // Larger resize handles (15px instead of 10px)
            const handleSize = 15;
            
            // Bottom-right handle
            ctx.fillStyle = '#007bff';
            ctx.fillRect(
                element.x + element.width - handleSize/2, 
                element.y + element.height - handleSize/2, 
                handleSize, 
                handleSize
            );
            
            // Top-right handle
            ctx.fillRect(
                element.x + element.width - handleSize/2, 
                element.y - handleSize/2, 
                handleSize, 
                handleSize
            );
            
            // Bottom-left handle
            ctx.fillRect(
                element.x - handleSize/2, 
                element.y + element.height - handleSize/2, 
                handleSize, 
                handleSize
            );
            ctx.restore();
        }
        
        ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
    });
}

function sampleColorAt(x, y) {
    if (!backgroundImage) return '#ffffff';
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(backgroundImage, 0, 0);
    try {
        const imageData = tempCtx.getImageData(x, y, 1, 1);
        const pixel = imageData.data;
        return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    } catch (e) {
        return '#ffffff';
    }
}

canvas.addEventListener('mousedown', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;

    if (currentMode === 'brush' && modifiedBackground) {
        isBrushing = true;
        colorSampled = false;
        lastBrushX = x;
        lastBrushY = y;
        sampledColor = sampleColorAt(x, y);
        document.getElementById('currentColor').style.backgroundColor = sampledColor;
        colorSampled = true;
        startBrushStroke();
        brush(x, y);
        return;
    }

    if (currentMode === 'edit') {
        if (selectedSignature) {
            // Add signature image
            const element = {
                id: Date.now(),
                type: 'image',
                image: selectedSignature.image,
                x: x - 75,
                y: y - 37,
                width: 150,
                height: 75,
                name: selectedSignature.name
            };
            imageElements.push(element);
            redraw();
            showNotification('Signature added', 'success');
        } else {
            showEditDialog(x, y);
        }
        return;
    }

    if (currentMode === 'move' && selectedElement?.type === 'image') {
        const handleSize = 15; // Should match the size used in redraw()
        
        // Check resize handles first with larger detection area
        if (x >= selectedElement.x + selectedElement.width - handleSize && 
            y >= selectedElement.y + selectedElement.height - handleSize) {
            // Bottom-right handle
            isResizing = 'br';
        } else if (x >= selectedElement.x + selectedElement.width - handleSize && 
                 y <= selectedElement.y + handleSize) {
            // Top-right handle
            isResizing = 'tr';
        } else if (x <= selectedElement.x + handleSize && 
                 y >= selectedElement.y + selectedElement.height - handleSize) {
            // Bottom-left handle
            isResizing = 'bl';
        } else {
            isDragging = true;
            isResizing = false;
        }
    }

    if (currentMode === 'move') {
        selectedElement = null;
        
        // Check image elements first
        for (let i = imageElements.length - 1; i >= 0; i--) {
            const element = imageElements[i];
            // Handle selection/dragging
            if (x >= element.x && x <= element.x + element.width &&
                y >= element.y && y <= element.y + element.height) {
                selectedElement = element;
                
                // Check if mouse is on a resize handle
                if (x >= element.x + element.width - 10 && y >= element.y + element.height - 10) {
                    // Bottom-right resize handle
                    isResizing = 'br';
                } else if (x >= element.x + element.width - 10 && y <= element.y + 10) {
                    // Top-right resize handle
                    isResizing = 'tr';
                } else if (x <= element.x + 10 && y >= element.y + element.height - 10) {
                    // Bottom-left resize handle
                    isResizing = 'bl';
                } else {
                    isDragging = true;
                    isResizing = false;
                }
                
                dragOffset.x = x - element.x;
                dragOffset.y = y - element.y;
                document.getElementById('deleteBtn').disabled = false;
                break;
            }
        }
        
        // Check text elements if no image was selected
        if (!selectedElement) {
            for (let i = textElements.length - 1; i >= 0; i--) {
                const element = textElements[i];
                ctx.font = `${element.fontSize}px ${element.fontFamily}`;
                const metrics = ctx.measureText(element.text);
                if (x >= element.x && x <= element.x + metrics.width &&
                    y >= element.y && y <= element.y + element.fontSize) {
                    selectedElement = element;
                    isDragging = true;
                    dragOffset.x = x - element.x;
                    dragOffset.y = y - element.y;
                    document.getElementById('deleteBtn').disabled = false;
                    break;
                }
            }
        }
        
        if (!selectedElement) {
            document.getElementById('deleteBtn').disabled = true;
        }
        redraw();
    }
});

canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    
    if (isBrushing && modifiedBackground && colorSampled) {
        brush(x, y);
        return;
    }
    if (currentMode === 'move' && selectedElement?.type === 'image') {
        const handleSize = 15;
        
        if (x >= selectedElement.x + selectedElement.width - handleSize && 
            y >= selectedElement.y + selectedElement.height - handleSize) {
            canvas.className = 'resize-bottom-right';
        } else if (x >= selectedElement.x + selectedElement.width - handleSize && 
                 y <= selectedElement.y + handleSize) {
            canvas.className = 'resize-top-right';
        } else if (x <= selectedElement.x + handleSize && 
                 y >= selectedElement.y + selectedElement.height - handleSize) {
            canvas.className = 'resize-bottom-left';
        } else if (x >= selectedElement.x && x <= selectedElement.x + selectedElement.width &&
                 y >= selectedElement.y && y <= selectedElement.y + selectedElement.height) {
            canvas.className = 'move';
        } else {
            canvas.className = '';
        }
    } else {
        canvas.className = '';
    }

    if (selectedElement && currentMode === 'move') {
        if (isDragging) {
            selectedElement.x = x - dragOffset.x;
            selectedElement.y = y - dragOffset.y;
            redraw();
        } else if (isResizing) {
            if (isResizing === 'br') {
                // Bottom-right handle - preserve aspect ratio
                const aspectRatio = selectedElement.image.width / selectedElement.image.height;
                const newWidth = Math.max(20, x - selectedElement.x);
                selectedElement.width = newWidth;
                selectedElement.height = newWidth / aspectRatio;
            } else if (isResizing === 'tr') {
                // Top-right handle - preserve aspect ratio
                const aspectRatio = selectedElement.image.width / selectedElement.image.height;
                const newWidth = Math.max(20, x - selectedElement.x);
                selectedElement.width = newWidth;
                const newHeight = newWidth / aspectRatio;
                selectedElement.y = selectedElement.y + selectedElement.height - newHeight;
                selectedElement.height = newHeight;
            } else if (isResizing === 'bl') {
                // Bottom-left handle
                const aspectRatio = selectedElement.image.width / selectedElement.image.height;
                const newHeight = Math.max(20, y - selectedElement.y);
                selectedElement.height = newHeight;
                selectedElement.width = newHeight * aspectRatio;
                selectedElement.x = selectedElement.x + selectedElement.width - (newHeight * aspectRatio);
            }
            redraw();
        }
    }
});

canvas.addEventListener('mouseup', function() {
    if (isBrushing) {
        isBrushing = false;
        colorSampled = false;
        endBrushStroke();
    }
    isDragging = false;
    isResizing = false;
});

function startBrushStroke() {
    brushStrokes.push([]);
}

function brush(x, y) {
    if (!modifiedBackground || !colorSampled) return;
    const modCtx = modifiedBackground.getContext('2d');
    const brushSize = parseInt(document.getElementById('brushSize').value);
    modCtx.globalCompositeOperation = 'source-over';
    modCtx.fillStyle = sampledColor;
    modCtx.beginPath();
    modCtx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
    modCtx.fill();
    if (lastBrushX && lastBrushY) {
        modCtx.lineWidth = brushSize;
        modCtx.lineCap = 'round';
        modCtx.strokeStyle = sampledColor;
        modCtx.beginPath();
        modCtx.moveTo(lastBrushX, lastBrushY);
        modCtx.lineTo(x, y);
        modCtx.stroke();
    }

    lastBrushX = x;
    lastBrushY = y;
    if (brushStrokes.length > 0) {
        brushStrokes[brushStrokes.length - 1].push({x, y, size: brushSize, color: sampledColor});
    }
    redraw();
}

function endBrushStroke() {
    // Logic to handle the end of a brush stroke
}

function undoLastBrush() {
    if (brushStrokes.length > 0) {
        brushStrokes.pop();
        if (backgroundImage && modifiedBackground) {
            const modCtx = modifiedBackground.getContext('2d');
            modCtx.clearRect(0, 0, canvas.width, canvas.height);
            modCtx.drawImage(backgroundImage, 0, 0);
            brushStrokes.forEach(stroke => {
                stroke.forEach((point, index) => {
                    modCtx.fillStyle = point.color;
                    modCtx.beginPath();
                    modCtx.arc(point.x, point.y, point.size / 2, 0, 2 * Math.PI);
                    modCtx.fill();
                    if (index > 0) {
                        const prevPoint = stroke[index - 1];
                        modCtx.lineWidth = point.size;
                        modCtx.lineCap = 'round';
                        modCtx.strokeStyle = point.color;
                        modCtx.beginPath();
                        modCtx.moveTo(prevPoint.x, prevPoint.y);
                        modCtx.lineTo(point.x, point.y);
                        modCtx.stroke();
                    }
                });
            });
            redraw();
            showNotification('Brush stroke undone', 'info');
        }
    }
}

function showEditDialog(x, y) {
    editingPosition = { x: x, y: y };
    const rect = canvas.getBoundingClientRect();
    editOverlay.style.left = Math.min(rect.left + x + 10, window.innerWidth - 350) + 'px';
    editOverlay.style.top = Math.max(rect.top + y - 100, 10) + 'px';
    editOverlay.style.display = 'block';
    document.getElementById('editInput').value = '';
    document.getElementById('editInput').focus();
}

function confirmEdit() {
    const newText = document.getElementById('editInput').value.trim();
    if (newText && editingPosition) {
        const element = {
            id: Date.now(),
            type: 'text',
            text: newText,
            x: editingPosition.x - 10,
            y: editingPosition.y - 12,
            fontFamily: document.getElementById('fontFamily').value,
            fontSize: parseInt(document.getElementById('fontSize').value),
            color: document.getElementById('textColor').value,
            isVariable: false
        };
        textElements.push(element);
        redraw();
        showNotification('Text added', 'success');
    }
    cancelEdit();
}

function makeVariable() {
    if (editingPosition) {
        let varName = prompt("Enter variable name (e.g., NAME, DATE):", "NAME");
        if (!varName) return;
        
        // Validate variable name
        varName = varName.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (!varName) {
            showNotification('Invalid variable name', 'error');
            return;
        }
        
        const element = {
            id: Date.now(),
            type: 'text',
            text: `{{${varName}}}`,
            x: editingPosition.x - 10,
            y: editingPosition.y - 12,
            fontFamily: document.getElementById('fontFamily').value,
            fontSize: parseInt(document.getElementById('fontSize').value),
            color: document.getElementById('textColor').value,
            isVariable: true
        };
        textElements.push(element);
        refreshVariableInputs();
        redraw();
        showNotification(`Variable "${varName}" added`, 'success');
    }
    cancelEdit();
}

function cancelEdit() {
    editOverlay.style.display = 'none';
    editingPosition = null;
}

function generateCertificates() {
    console.log('generateCertificates called'); // Debug log
    const variableNames = [...new Set(textElements.filter(e => e.isVariable).map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1]))];
    console.log('Variable names for generation:', variableNames); // Debug log
    
    if (variableNames.length === 0) {
        showNotification("Please add at least one variable field.", 'error');
        return;
    }
    
    // Allow generation even without background image
    // if (!backgroundImage && !modifiedBackground) {
    //     showNotification("Please upload a template first.", 'error');
    //     return;
    // }
    
    const tableInputs = Array.from(variableFieldsContainer.querySelectorAll('input'));
    console.log('Table inputs found:', tableInputs.length); // Debug log
    const rowsData = [];
    const maxRow = Math.max(...tableInputs.map(inp => parseInt(inp.dataset.row))) + 1;
    
    for (let r = 0; r < maxRow; r++) {
        const rowObj = {};
        variableNames.forEach(v => {
            const input = tableInputs.find(inp => inp.dataset.var === v && parseInt(inp.dataset.row) === r);
            rowObj[v] = input ? input.value.trim() : "";
        });
        if (Object.values(rowObj).some(val => val !== "")) {
            rowsData.push(rowObj);
        }
    }
    
    if (rowsData.length === 0) {
        showNotification("Please fill in at least one row of data.", 'error');
        return;
    }
    
    showNotification(`Generating ${rowsData.length} certificates...`, 'info');
    
    rowsData.forEach((rowData, index) => {
        setTimeout(() => {
            generateSingleCertificateWithVars(rowData);
            if (index === rowsData.length - 1) {
                showNotification(`All ${rowsData.length} certificates generated successfully!`, 'success');
            }
        }, index * 100);
    });
}

function generateSingleCertificateWithVars(vars) {
    // Use the background image's native resolution if available
    let exportWidth = canvas.width;
    let exportHeight = canvas.height;
    let bgSource = null;
    if (modifiedBackground) {
        exportWidth = modifiedBackground.width;
        exportHeight = modifiedBackground.height;
        bgSource = modifiedBackground;
    } else if (backgroundImage) {
        exportWidth = backgroundImage.width;
        exportHeight = backgroundImage.height;
        bgSource = backgroundImage;
    }
    const scaleFactor = exportWidth / canvas.width;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = exportWidth;
    tempCanvas.height = exportHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw background
    if (bgSource) {
        tempCtx.drawImage(bgSource, 0, 0, exportWidth, exportHeight);
    } else {
        tempCtx.fillStyle = '#fff';
        tempCtx.fillRect(0, 0, exportWidth, exportHeight);
    }

    // Draw text elements scaled
    textElements.forEach(element => {
        tempCtx.save();
        tempCtx.font = `${element.fontSize * scaleFactor}px ${element.fontFamily}`;
        tempCtx.fillStyle = element.color;
        tempCtx.textBaseline = 'top';
        let text = element.text;
        if (element.isVariable) {
            const match = element.text.match(/\{\{(.+?)\}\}/);
            if (match && vars[match[1]] !== undefined) {
                text = vars[match[1]];
            }
        }
        tempCtx.fillText(text, element.x * scaleFactor, element.y * scaleFactor);
        tempCtx.restore();
    });

    // Draw image elements scaled
    imageElements.forEach(element => {
        tempCtx.save();
        tempCtx.drawImage(
            element.image,
            element.x * scaleFactor,
            element.y * scaleFactor,
            element.width * scaleFactor,
            element.height * scaleFactor
        );
        tempCtx.restore();
    });

    const fileName = Object.values(vars).filter(Boolean).join('_') || "certificate";
    const dataURL = tempCanvas.toDataURL('image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
    a.click();
}

function downloadCanvasImage() {
    // Use the background image's native resolution if available
    let exportWidth = canvas.width;
    let exportHeight = canvas.height;
    let bgSource = null;
    if (modifiedBackground) {
        exportWidth = modifiedBackground.width;
        exportHeight = modifiedBackground.height;
        bgSource = modifiedBackground;
    } else if (backgroundImage) {
        exportWidth = backgroundImage.width;
        exportHeight = backgroundImage.height;
        bgSource = backgroundImage;
    }
    const scaleFactor = exportWidth / canvas.width;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const exportCtx = exportCanvas.getContext('2d');

    // Draw background
    if (bgSource) {
        exportCtx.drawImage(bgSource, 0, 0, exportWidth, exportHeight);
    } else {
        exportCtx.fillStyle = '#fff';
        exportCtx.fillRect(0, 0, exportWidth, exportHeight);
    }

    // Draw text elements scaled
    textElements.forEach(el => {
        exportCtx.save();
        exportCtx.font = `${el.fontSize * scaleFactor}px ${el.fontFamily}`;
        exportCtx.fillStyle = el.color;
        exportCtx.textBaseline = 'top';
        exportCtx.fillText(el.text, el.x * scaleFactor, el.y * scaleFactor);
        exportCtx.restore();
    });
    // Draw image elements scaled
    imageElements.forEach(el => {
        exportCtx.save();
        exportCtx.drawImage(
            el.image,
            el.x * scaleFactor,
            el.y * scaleFactor,
            el.width * scaleFactor,
            el.height * scaleFactor
        );
        exportCtx.restore();
    });

    const link = document.createElement('a');
    link.download = 'certificate.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}


// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Delete' && selectedElement) {
        deleteSelected();
    }
    if (e.key === 'Escape') {
        cancelEdit();
    }
});

// Enter key in edit input
document.getElementById('editInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        confirmEdit();
    }
});

document.getElementById('variableDataUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            processCSVData(csvData);
        };
        reader.readAsText(file);
    }
});

function processCSV() {
    const fileInput = document.getElementById('variableDataUpload');
    const statusElement = document.getElementById('csvStatus');
    
    if (!fileInput.files.length) {
        showNotification('Please select a CSV file first', 'error');
        statusElement.textContent = 'No file selected';
        statusElement.style.color = '#dc3545';
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(event) {
        try {
            const csvData = event.target.result;
            const rows = parseCSV(csvData);
            
            if (rows.length === 0) {
                showNotification('CSV file is empty', 'error');
                statusElement.textContent = 'Empty CSV file';
                statusElement.style.color = '#dc3545';
                return;
            }

            const variableNames = [...new Set(
                textElements.filter(e => e.isVariable)
                           .map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1])
                           .filter(Boolean)
            )];

            if (variableNames.length === 0) {
                showNotification('No variables defined on the canvas', 'error');
                statusElement.textContent = 'No variables found';
                statusElement.style.color = '#dc3545';
                return;
            }

            // Clear existing variable fields
            variableFieldsContainer.innerHTML = "";
            const heading = document.createElement('h6');
            heading.textContent = 'CSV Data Imported';
            heading.className = 'mb-3 text-success';
            variableFieldsContainer.appendChild(heading);

            const table = document.createElement('table');
            table.className = 'variable-table table table-sm table-striped';

            // Create header row
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<th>Row</th>` + 
                variableNames.map(v => `<th>${v}</th>`).join('');
            table.appendChild(headerRow);

            // Process each data row
            rows.forEach((rowData, index) => {
                // Add data row
                const dataRow = document.createElement('tr');
                dataRow.innerHTML = `<td>${index + 1}</td>` + 
                    variableNames.map((v, i) => 
                        `<td><input type="text" class="form-control form-control-sm" data-var="${v}" data-row="${index}" value="${rowData[i] || ''}"></td>`
                    ).join('');
                table.appendChild(dataRow);
            });

            // Add one final blank row at the end
            const finalBlankRow = document.createElement('tr');
            finalBlankRow.innerHTML = `<td>${rows.length + 1}</td>` + 
                variableNames.map((v, i) => 
                    `<td><input type="text" class="form-control form-control-sm" data-var="${v}" data-row="${rows.length}" 
                         placeholder="Optional" oninput="checkAddNewRow()"></td>`
                ).join('');
            table.appendChild(finalBlankRow);

            variableFieldsContainer.appendChild(table);
            
            showNotification(`${rows.length} CSV rows processed`, 'success');
            statusElement.textContent = `Processed ${rows.length} rows with ${variableNames.length} variables each`;
            statusElement.style.color = '#28a745';
        } catch (error) {
            console.error('CSV processing error:', error);
            showNotification('Error processing CSV file', 'error');
            statusElement.textContent = 'Error: ' + error.message;
            statusElement.style.color = '#dc3545';
        }
    };

    reader.onerror = function() {
        showNotification('Error reading CSV file', 'error');
        statusElement.textContent = 'File read error';
        statusElement.style.color = '#dc3545';
    };

    reader.readAsText(file);
}

const style = document.createElement('style');
style.textContent = `
    canvas.resize-bottom-right { cursor: nwse-resize; }
    canvas.resize-top-right { cursor: nesw-resize; }
    canvas.resize-bottom-left { cursor: nesw-resize; }
    canvas.move { cursor: move; }
`;
document.head.appendChild(style);

// Helper function to parse CSV with proper handling of quoted fields
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
        // Simple split that handles basic quoted fields
        return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
                  .map(cell => cell.replace(/^"|"$/g, '').trim());
    });
}

function processCSVData(csv) {
    const rows = csv.split('\n').map(row => row.split(',').map(cell => cell.trim()));
    const variableNames = [...new Set(textElements.filter(e => e.isVariable).map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1]))];

    // Clear existing variable fields
    variableFieldsContainer.innerHTML = "";

    // Create a table for variable inputs
    const table = document.createElement('table');
    table.className = 'variable-table';

    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th>Row</th>` + variableNames.map(v => `<th>${v}</th>`).join('');
    table.appendChild(headerRow);

    // Populate table with CSV data
    rows.forEach((row, index) => {
        const rowElement = document.createElement('tr');
        rowElement.innerHTML = `<td>${index + 1}</td>` + variableNames.map((v, i) => 
            `<td><input type="text" data-var="${v}" data-row="${index}" value="${row[i] || ''}"></td>`
        ).join('');
        table.appendChild(rowElement);
    });

    variableFieldsContainer.appendChild(table);
    showNotification('Variable data uploaded successfully!', 'success');
}

// Initialize
updateCursor();
updateSidebarForSelection();

// Initialize canvas with a basic background
function initializeCanvas() {
    if (textElements.length === 0 && imageElements.length === 0 && !backgroundImage && !modifiedBackground) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Upload a template to get started', canvas.width/2, canvas.height/2);
        ctx.fillText('or add text/variables directly', canvas.width/2, canvas.height/2 + 30);
        ctx.textAlign = 'left'; // Reset text alignment
    }
}

initializeCanvas();

// Force redraw function for testing
function forceRedraw() {
    console.log('Force redraw called, current textElements:', textElements);
    redraw();
}

// Wire up Generate All Certificates button
document.getElementById('downloadBtn').addEventListener('click', generateCertificates);
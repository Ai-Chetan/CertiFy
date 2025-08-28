/**
 * CertiFy - Professional Certificate Generator
 * 
 * Main Functions:
 * - Template Management: Upload and modify certificate templates
 * - Text Editing: Add, edit, and position text elements with variable support
 * - Signature Handling: Upload, position, and resize signature images
 * - Brush Tool: Paint over unwanted content on templates
 * - Batch Generation: Generate multiple certificates with CSV data import
 * - Export: Download certificates as high-quality images
 */

// Canvas and UI Elements
const canvas = document.getElementById('certificateCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const editOverlay = document.getElementById('editOverlay');
const variableFieldsContainer = document.getElementById('variableFieldsContainer');

// Application State
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

// Brush Tool State
let isBrushing = false;
let lastBrushX = 0;
let lastBrushY = 0;
let sampledColor = '#ffffff';
let colorSampled = false;

/**
 * Gets the appropriate font family with fallbacks
 * @param {string} fontFamily - The selected font family
 * @returns {string} Font family with appropriate fallbacks
 */
function getFontWithFallbacks(fontFamily) {
    const fontMap = {
        // Google Fonts with fallbacks
        'Cinzel': '"Cinzel", "Trajan Pro", "Times New Roman", serif',
        'Playfair Display': '"Playfair Display", "Georgia", "Times New Roman", serif',
        'Cormorant Garamond': '"Cormorant Garamond", "Garamond", "Times New Roman", serif',
        'Libre Baskerville': '"Libre Baskerville", "Baskerville", "Georgia", serif',
        'Crimson Text': '"Crimson Text", "Times New Roman", "Georgia", serif',
        'Dancing Script': '"Dancing Script", "Brush Script MT", "Lucida Handwriting", cursive',
        'Great Vibes': '"Great Vibes", "Edwardian Script ITC", "Monotype Corsiva", cursive',
        
        // System fonts with fallbacks
        'Garamond': '"Garamond", "Times New Roman", serif',
        'Book Antiqua': '"Book Antiqua", "Palatino Linotype", "Georgia", serif',
        'Palatino Linotype': '"Palatino Linotype", "Book Antiqua", "Georgia", serif',
        'Baskerville': '"Baskerville", "Georgia", "Times New Roman", serif',
        'Century Gothic': '"Century Gothic", "Arial", "Helvetica", sans-serif',
        'Franklin Gothic Medium': '"Franklin Gothic Medium", "Arial Black", "Arial", sans-serif',
        'Brush Script MT': '"Brush Script MT", "Dancing Script", "Lucida Handwriting", cursive',
        'Lucida Handwriting': '"Lucida Handwriting", "Brush Script MT", "Dancing Script", cursive',
        'Edwardian Script ITC': '"Edwardian Script ITC", "Monotype Corsiva", "Great Vibes", cursive',
        'Monotype Corsiva': '"Monotype Corsiva", "Edwardian Script ITC", "Great Vibes", cursive',
        'French Script MT': '"French Script MT", "Edwardian Script ITC", "Monotype Corsiva", cursive',
        'Old English Text MT': '"Old English Text MT", "Blackletter", "Times New Roman", serif',
        'Trajan Pro': '"Trajan Pro", "Cinzel", "Times New Roman", serif',
        'Optima': '"Optima", "Helvetica", "Arial", sans-serif',
        'Minion Pro': '"Minion Pro", "Georgia", "Times New Roman", serif',
        'Adobe Caslon Pro': '"Adobe Caslon Pro", "Book Antiqua", "Georgia", serif',
        'Copperplate Gothic': '"Copperplate Gothic", "Impact", "Arial Black", sans-serif',
        'Papyrus': '"Papyrus", "fantasy", "Times New Roman", serif',
        'Algerian': '"Algerian", "Impact", "Arial Black", sans-serif',
        'Broadway': '"Broadway", "Impact", "Arial Black", sans-serif',
        'Chiller': '"Chiller", "fantasy", "Times New Roman", serif'
    };
    
    return fontMap[fontFamily] || fontFamily;
}

/**
 * Updates the sidebar controls based on the currently selected element
 * Syncs text input fields with element properties
 */
function updateSidebarForSelection() {
    const textInput = document.getElementById('textContent');
    const fontFamilyInput = document.getElementById('fontFamily');
    const fontSizeInput = document.getElementById('fontSize');
    const colorInput = document.getElementById('textColor');
    const sidebar = document.querySelector('.sidebar');
    let nameDisplay = document.getElementById('selectedNameDisplay');
    
    if (!nameDisplay) {
        nameDisplay = document.createElement('div');
        nameDisplay.id = 'selectedNameDisplay';
        nameDisplay.style.fontWeight = 'bold';
        nameDisplay.style.fontSize = '18px';
        nameDisplay.style.marginBottom = '10px';
        sidebar.insertBefore(nameDisplay, sidebar.firstChild);
    }
    
    if (selectedElement && selectedElement.type === 'text') {
        let displayName = selectedElement.isVariable
            ? (selectedElement.text.match(/\{\{(.+?)\}\}/)?.[1] || 'Variable')
            : selectedElement.text;
        nameDisplay.textContent = displayName;
        textInput.value = selectedElement.isVariable ? displayName : selectedElement.text;
        fontFamilyInput.value = selectedElement.fontFamily;
        fontSizeInput.value = selectedElement.fontSize;
        colorInput.value = selectedElement.color;
        textInput.disabled = false;
        fontFamilyInput.disabled = false;
        fontSizeInput.disabled = false;
        colorInput.disabled = false;
    } else {
        nameDisplay.textContent = '';
        textInput.value = '';
        fontFamilyInput.value = 'Arial';
        fontSizeInput.value = 24;
        colorInput.value = '#000000';
        textInput.disabled = false;
        fontFamilyInput.disabled = false;
        fontSizeInput.disabled = false;
        colorInput.disabled = false;
    }
}

/**
 * Event listeners for sidebar text editing controls
 * Updates selected element properties in real-time
 */
document.getElementById('textContent').addEventListener('input', function() {
    if (selectedElement && selectedElement.type === 'text') {
        if (selectedElement.isVariable) {
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

/**
 * Displays notification messages to the user
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (info, success, error)
 */
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

/**
 * Creates the variable input table for data entry
 * Automatically generates input fields for all variables in the template
 */
function refreshVariableInputs() {
    variableFieldsContainer.innerHTML = "";
    const variableNames = [...new Set(textElements.filter(e => e.isVariable).map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1]))];
    
    if (variableNames.length > 0) {
        const heading = document.createElement('h3');
        heading.textContent = 'Variable Data';
        variableFieldsContainer.appendChild(heading);

        const table = document.createElement('table');
        table.className = 'variable-table';
        
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th>Sr. No.</th>` + variableNames.map(v => `<th>${v}</th>`).join('');
        table.appendChild(headerRow);

        addTableRow(table, variableNames, 0);
        variableFieldsContainer.appendChild(table);
    }
}

/**
 * Adds a new row to the variable input table
 * @param {HTMLTableElement} table - The table to add the row to
 * @param {Array} variableNames - List of variable names
 * @param {number} rowIndex - Index of the row
 */
function addTableRow(table, variableNames, rowIndex) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${rowIndex + 1}</td>` + variableNames.map(v => 
        `<td><input type="text" data-var="${v}" data-row="${rowIndex}" oninput="checkAddNewRow()"></td>`
    ).join('');
    table.appendChild(row);
}

/**
 * Checks if a new row should be added to the variable table
 * Automatically adds new rows when the last row has data
 */
function checkAddNewRow() {
    const table = variableFieldsContainer.querySelector('table');
    if (!table) return;

    const inputs = Array.from(table.querySelectorAll('input'));
    const variableNames = [...new Set(textElements.filter(e => e.isVariable).map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1]))];
    
    const maxRow = Math.max(...inputs.map(inp => parseInt(inp.dataset.row)));
    const lastRowInputs = inputs.filter(inp => parseInt(inp.dataset.row) === maxRow);
    const lastRowHasData = lastRowInputs.some(inp => inp.value.trim() !== '');

    if (lastRowHasData) {
        addTableRow(table, variableNames, maxRow + 1);
    }
}

/**
 * Handles signature image upload and processing
 */
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

/**
 * Updates the signature list display in the UI
 */
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
        list.innerHTML = '<p style="color: #666; text-align: center; margin: 10px 0;">No images uploaded yet</p>';
    }
}

/**
 * Selects a signature for use
 * @param {string} id - Signature ID
 */
function selectSignature(id) {
    selectedSignature = signatures.find(sig => sig.id == id);
    updateSignatureList();
    document.getElementById('addSignatureBtn').disabled = !selectedSignature;
}

/**
 * Deletes a signature from the list
 * @param {string} id - Signature ID
 * @param {Event} event - Click event
 */
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

/**
 * Adds the selected signature to the canvas
 */
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

/**
 * Zoom System - Clean Implementation
 * Maintains canvas at 100% internal size for consistent image quality
 * Visual zoom is handled through CSS transforms on the container
 */

// Zoom configuration
const ZOOM_CONFIG = {
    min: 0.25,      // 25% minimum zoom
    max: 4.0,       // 400% maximum zoom  
    step: 1.25,     // 25% zoom increment
    default: 1.0    // 100% default zoom
};

/**
 * Increases zoom level by configured step
 */
function zoomIn() {
    const newZoom = Math.min(zoomLevel * ZOOM_CONFIG.step, ZOOM_CONFIG.max);
    setZoomLevel(newZoom);
}

/**
 * Decreases zoom level by configured step
 */
function zoomOut() {
    const newZoom = Math.max(zoomLevel / ZOOM_CONFIG.step, ZOOM_CONFIG.min);
    setZoomLevel(newZoom);
}

/**
 * Resets zoom to default level (100%)
 */
function resetZoom() {
    setZoomLevel(ZOOM_CONFIG.default);
}

/**
 * Sets zoom level and updates the display
 * @param {number} newZoom - New zoom level (0.25 to 4.0)
 */
function setZoomLevel(newZoom) {
    // Clamp zoom level to valid range
    zoomLevel = Math.max(ZOOM_CONFIG.min, Math.min(ZOOM_CONFIG.max, newZoom));
    
    // Update visual display
    updateZoomDisplay();
    updateZoomIndicator();
}

/**
 * Updates zoom indicator styling with visual feedback
 */
function updateZoomIndicator() {
    const zoomDisplay = document.querySelector('.zoom-display');
    if (zoomDisplay) {
        // Update percentage display
        zoomDisplay.textContent = Math.round(zoomLevel * 100) + '%';
        
        // Add visual state classes
        zoomDisplay.classList.toggle('zoomed-in', zoomLevel > 1.05);
        zoomDisplay.classList.toggle('zoomed-out', zoomLevel < 0.95);
    }
}

/**
 * Updates the visual zoom display and layout
 * Keeps canvas at 100% internal size, applies visual scaling to container
 */
function updateZoomDisplay() {
    const workspace = document.querySelector('.canvas-workspace');
    const container = document.getElementById('canvasContainer');
    
    if (!workspace || !container) return;
    
    // Apply visual zoom via CSS transform (keeps canvas internal size at 100%)
    applyZoomTransform(container);
    
    // Update layout and centering based on zoom level
    updateWorkspaceLayout(workspace, container);
    
    // Update scroll indicators if content overflows
    updateScrollIndicators(workspace, container);
    
    // Scroll to center the content after zoom change
    setTimeout(() => scrollToCenter(workspace, container), 50);
    
    // Update zoom level display
    updateZoomLevelDisplay();
}

/**
 * Applies zoom transform to container while maintaining internal canvas size
 * @param {HTMLElement} container - Canvas container element
 */
function applyZoomTransform(container) {
    // Apply scale transform to container (visual zoom only)
    container.style.transform = `scale(${zoomLevel})`;
    container.style.transformOrigin = 'top left';
    
    // Keep canvas at native resolution (100% internal size)
    canvas.style.transform = 'none';
    canvas.style.transformOrigin = 'initial';
    
    // Maintain original container dimensions
    container.style.width = `${canvas.width}px`;
    container.style.height = `${canvas.height}px`;
}

/**
 * Updates workspace layout and centering based on zoom level
 * Always keeps content centered, enables scrolling when needed
 * @param {HTMLElement} workspace - Canvas workspace element  
 * @param {HTMLElement} container - Canvas container element
 */
function updateWorkspaceLayout(workspace, container) {
    // Calculate scaled dimensions for layout decisions
    const scaledWidth = canvas.width * zoomLevel;
    const scaledHeight = canvas.height * zoomLevel;
    const workspaceRect = workspace.getBoundingClientRect();
    const availableWidth = workspaceRect.width - 40; // Account for padding
    const availableHeight = workspaceRect.height - 40;
    
    // Determine if content fits in workspace
    const fitsHorizontally = scaledWidth <= availableWidth;
    const fitsVertically = scaledHeight <= availableHeight;
    const fitsCompletely = fitsHorizontally && fitsVertically;
    
    // Always center the content - enable scrolling when it overflows
    centerContentInWorkspace(workspace, container, fitsCompletely);
}

/**
 * Centers content in workspace and handles overflow with scrolling
 * @param {HTMLElement} workspace - Canvas workspace element
 * @param {HTMLElement} container - Canvas container element  
 * @param {boolean} fitsCompletely - Whether content fits without scrolling
 */
function centerContentInWorkspace(workspace, container, fitsCompletely = true) {
    // Always use flexbox centering
    workspace.style.display = 'flex';
    workspace.style.justifyContent = 'center';
    workspace.style.alignItems = 'center';
    
    // Handle overflow vs no-overflow scenarios
    if (fitsCompletely) {
        // Content fits - no scrolling needed, reset padding
        workspace.style.overflow = 'hidden';
        workspace.style.padding = '20px'; // Reset to default padding
    } else {
        // Content overflows - enable scrolling while keeping centered
        workspace.style.overflow = 'auto';
        
        // Ensure the container can be scrolled to show all content
        // Add padding to allow scrolling past center point
        const scaledWidth = canvas.width * zoomLevel;
        const scaledHeight = canvas.height * zoomLevel;
        const workspaceRect = workspace.getBoundingClientRect();
        const extraPaddingX = Math.max(0, (workspaceRect.width - scaledWidth) / 2);
        const extraPaddingY = Math.max(0, (workspaceRect.height - scaledHeight) / 2);
        
        // Set minimum padding to enable center scrolling
        const paddingX = Math.max(20, extraPaddingX);
        const paddingY = Math.max(20, extraPaddingY);
        
        workspace.style.padding = `${paddingY}px ${paddingX}px`;
    }
    
    // Reset container positioning to work with flexbox
    container.style.position = 'static';
    container.style.margin = '0';
    container.style.left = 'auto';
    container.style.top = 'auto';
}

/**
 * Updates scroll indicators when content overflows workspace
 * @param {HTMLElement} workspace - Canvas workspace element
 * @param {HTMLElement} container - Canvas container element
 */
function updateScrollIndicators(workspace, container) {
    const workspaceRect = workspace.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Add CSS classes for scroll indicators
    workspace.classList.toggle('has-horizontal-scroll', 
        containerRect.width > workspaceRect.width);
    workspace.classList.toggle('has-vertical-scroll', 
        containerRect.height > workspaceRect.height);
}

/**
 * Scrolls the workspace to center the canvas content
 * @param {HTMLElement} workspace - Canvas workspace element
 * @param {HTMLElement} container - Canvas container element
 */
function scrollToCenter(workspace, container) {
    // Only scroll if content overflows and scrolling is enabled
    if (workspace.style.overflow === 'auto') {
        // Calculate the center scroll position
        const scaledWidth = canvas.width * zoomLevel;
        const scaledHeight = canvas.height * zoomLevel;
        const workspaceRect = workspace.getBoundingClientRect();
        
        // Calculate scroll positions to center the content
        const maxScrollLeft = workspace.scrollWidth - workspace.clientWidth;
        const maxScrollTop = workspace.scrollHeight - workspace.clientHeight;
        
        const targetScrollLeft = Math.max(0, Math.min(maxScrollLeft, 
            (scaledWidth - workspace.clientWidth) / 2));
        const targetScrollTop = Math.max(0, Math.min(maxScrollTop, 
            (scaledHeight - workspace.clientHeight) / 2));
        
        // Smooth scroll to center
        workspace.scrollTo({
            left: targetScrollLeft,
            top: targetScrollTop,
            behavior: 'smooth'
        });
    }
}

/**
 * Updates the zoom level percentage display
 */
function updateZoomLevelDisplay() {
    const zoomLevelElement = document.getElementById('zoomLevel');
    if (zoomLevelElement) {
        zoomLevelElement.textContent = Math.round(zoomLevel * 100) + '%';
    }
}

/**
 * Shows or hides the template upload overlay
 */
function updateTemplateUploadOverlay() {
    const overlay = document.getElementById('templateUploadOverlay');
    if (overlay) {
        overlay.style.display = backgroundImage ? 'none' : 'flex';
    }
}

/**
 * Handles editing mode changes
 */
document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        currentMode = this.value;
        updateCursor();
        document.getElementById('brushControls').style.display = 
            currentMode === 'brush' ? 'block' : 'none';
        
        // Update mode instructions
        document.querySelectorAll('.mode-instructions').forEach(instruction => {
            instruction.style.display = 'none';
        });
        const currentInstruction = document.querySelector(`[data-mode="${currentMode}"]`);
        if (currentInstruction) {
            currentInstruction.style.display = 'flex';
        }
    });
});

document.getElementById('brushSize').addEventListener('input', function(e) {
    document.getElementById('brushSizeDisplay').textContent = e.target.value + 'px';
});

/**
 * Auto-fit Template System
 * Automatically scales templates to fit optimally in the workspace
 * while maintaining aspect ratio and setting zoom to 100%
 */

/**
 * Calculates optimal canvas dimensions for a template to fit in workspace
 * @param {number} imageWidth - Original image width
 * @param {number} imageHeight - Original image height
 * @returns {Object} Optimal dimensions {width, height, scale}
 */
function calculateOptimalCanvasSize(imageWidth, imageHeight) {
    const workspace = document.querySelector('.canvas-workspace');
    if (!workspace) {
        return { width: imageWidth, height: imageHeight, scale: 1 };
    }
    
    // Get available workspace dimensions (accounting for padding and UI)
    const workspaceRect = workspace.getBoundingClientRect();
    const maxWidth = Math.floor(workspaceRect.width * 0.8); // 80% of workspace width
    const maxHeight = Math.floor(workspaceRect.height * 0.8); // 80% of workspace height
    
    // Ensure reasonable size limits
    const minWidth = Math.min(400, maxWidth * 0.5);
    const minHeight = Math.min(300, maxHeight * 0.5);
    const maxCanvasWidth = Math.min(1920, maxWidth); // Limit to reasonable max
    const maxCanvasHeight = Math.min(1080, maxHeight);
    
    // Calculate scale factors to fit within workspace
    const scaleToFitX = maxCanvasWidth / imageWidth;
    const scaleToFitY = maxCanvasHeight / imageHeight;
    const scaleToFit = Math.min(scaleToFitX, scaleToFitY, 1); // Don't upscale
    
    // Calculate initial dimensions
    let finalWidth = Math.round(imageWidth * scaleToFit);
    let finalHeight = Math.round(imageHeight * scaleToFit);
    
    // Ensure minimum dimensions for usability
    if (finalWidth < minWidth) {
        const scale = minWidth / finalWidth;
        finalWidth = minWidth;
        finalHeight = Math.round(finalHeight * scale);
    }
    if (finalHeight < minHeight) {
        const scale = minHeight / finalHeight;
        finalHeight = minHeight;
        finalWidth = Math.round(finalWidth * scale);
    }
    
    // Final check to ensure it still fits in workspace
    if (finalWidth > maxCanvasWidth) {
        const scale = maxCanvasWidth / finalWidth;
        finalWidth = maxCanvasWidth;
        finalHeight = Math.round(finalHeight * scale);
    }
    if (finalHeight > maxCanvasHeight) {
        const scale = maxCanvasHeight / finalHeight;
        finalHeight = maxCanvasHeight;
        finalWidth = Math.round(finalWidth * scale);
    }
    
    return {
        width: finalWidth,
        height: finalHeight,
        scale: finalWidth / imageWidth
    };
}

/**
 * Auto-fits template to optimal size while preserving original image quality
 * Uses CSS scaling for display rather than re-drawing to maintain quality
 * @param {Image} originalImage - The uploaded template image
 */
function autoFitTemplate(originalImage) {
    const optimal = calculateOptimalCanvasSize(originalImage.width, originalImage.height);
    
    // Set canvas to the size that fits best in workspace
    canvas.width = optimal.width;
    canvas.height = optimal.height;
    
    // Store the original high-quality image without modification
    backgroundImage = originalImage;
    
    // Create modified background canvas at the same size as display canvas
    modifiedBackground = document.createElement('canvas');
    modifiedBackground.width = optimal.width;
    modifiedBackground.height = optimal.height;
    const modCtx = modifiedBackground.getContext('2d');
    
    // Draw the original image scaled to the optimal size only for editing overlay
    // This preserves the original image quality in backgroundImage
    modCtx.drawImage(originalImage, 0, 0, optimal.width, optimal.height);
    
    // Reset zoom to 100% for consistent experience
    setZoomLevel(1.0);
    
    // Update display and notify user
    updateTemplateUploadOverlay();
    redraw();
    
    const scalePercent = Math.round(optimal.scale * 100);
    showNotification(
        `Template fitted to ${optimal.width}×${optimal.height} (${scalePercent}% scale)`, 
        'success'
    );
}

/**
 * Provides preset canvas sizes for common certificate formats
 * @returns {Object} Preset dimensions for different certificate types
 */
function getPresetCanvasSizes() {
    return {
        'landscape-a4': { width: 1123, height: 794, name: 'A4 Landscape' },
        'portrait-a4': { width: 794, height: 1123, name: 'A4 Portrait' },
        'landscape-letter': { width: 1056, height: 816, name: 'Letter Landscape' },
        'portrait-letter': { width: 816, height: 1056, name: 'Letter Portrait' },
        'square': { width: 800, height: 800, name: 'Square' },
        'wide': { width: 1200, height: 675, name: 'Wide Format' }
    };
}

/**
 * Manually resize template to specific dimensions
 * @param {number} targetWidth - Target canvas width
 * @param {number} targetHeight - Target canvas height
 */
function resizeTemplateToSize(targetWidth, targetHeight) {
    if (!backgroundImage) {
        showNotification('Please upload a template first', 'error');
        return;
    }
    
    // Store original image
    const originalImage = new Image();
    originalImage.onload = function() {
        // Set canvas to target size
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Create new background at target size
        modifiedBackground = document.createElement('canvas');
        modifiedBackground.width = targetWidth;
        modifiedBackground.height = targetHeight;
        const modCtx = modifiedBackground.getContext('2d');
        
        // Draw scaled image to fill target size
        modCtx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);
        
        // Update background image
        backgroundImage = new Image();
        backgroundImage.onload = function() {
            setZoomLevel(1.0);
            updateTemplateUploadOverlay();
            redraw();
            showNotification(`Template resized to ${targetWidth}×${targetHeight}`, 'success');
        };
        
        backgroundImage.src = modifiedBackground.toDataURL();
    };
    
    // Get current background image data
    if (modifiedBackground) {
        originalImage.src = modifiedBackground.toDataURL();
    } else {
        // Fallback to drawing current background
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(backgroundImage, 0, 0);
        originalImage.src = tempCanvas.toDataURL();
    }
}

/**
 * Updates the cursor based on the current mode
 */
function updateCursor() {
    if (currentMode === 'brush') {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'default';
    }
}

/**
 * Handles template image upload with auto-fit functionality
 */
document.getElementById('templateUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // Auto-fit the template to optimal size
                autoFitTemplate(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

/**
 * Adds a text element to the canvas
 */
function addText() {
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

    textElements.push(element);
    selectedElement = element;
    updateSidebarForSelection();
    redraw();
    showNotification('Text added', 'success');
}

/**
 * Adds a variable element to the canvas
 */
function addVariable() {
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

    textElements.push(element);
    selectedElement = element;
    updateSidebarForSelection();
    refreshVariableInputs();
    redraw();
    showNotification(`Variable "${varName}" added`, 'success');
}

/**
 * Deletes the currently selected element
 */
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

/**
 * Redraws the entire canvas with all elements at full quality
 */
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image at full quality
    if (modifiedBackground) {
        ctx.drawImage(modifiedBackground, 0, 0);
    } else if (backgroundImage) {
        // Draw the background image scaled to canvas size while preserving quality
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    textElements.forEach(element => {
        const fontWithFallbacks = getFontWithFallbacks(element.fontFamily);
        ctx.font = `${element.fontSize}px ${fontWithFallbacks}`;
        ctx.fillStyle = element.color;
        ctx.textBaseline = 'top';
        
        // Set text alignment based on the element's alignment property
        ctx.textAlign = element.alignment || 'center';

        if (element === selectedElement) {
            const metrics = ctx.measureText(element.text);
            ctx.save();
            ctx.fillStyle = 'rgba(0, 124, 186, 0.2)';
            if (element.isVariable) {
                ctx.fillRect(element.x - metrics.width/2 - 2, element.y - 2, metrics.width + 4, element.fontSize + 4);
            } else {
                ctx.fillRect(element.x - 2, element.y - 2, metrics.width + 4, element.fontSize + 4);
            }
            ctx.restore();
            ctx.fillStyle = element.color;
        }

        if (element.isVariable) {
            const metrics = ctx.measureText(element.text);
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(element.x - metrics.width/2 - 2, element.y - 2, metrics.width + 4, element.fontSize + 4);
            ctx.restore();
            ctx.fillStyle = element.color;
        }

        ctx.fillText(element.text, element.x, element.y);
        
        // Reset text alignment to default
        ctx.textAlign = 'left';
    });

    imageElements.forEach(element => {
        if (element === selectedElement) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 124, 186, 0.2)';
            ctx.fillRect(element.x - 4, element.y - 4, element.width + 8, element.height + 8);
            
            const handleSize = 15;
            
            ctx.fillStyle = '#007bff';
            ctx.fillRect(
                element.x + element.width - handleSize/2, 
                element.y + element.height - handleSize/2, 
                handleSize, 
                handleSize
            );
            
            ctx.fillRect(
                element.x + element.width - handleSize/2, 
                element.y - handleSize/2, 
                handleSize, 
                handleSize
            );
            
            ctx.fillRect(
                element.x - handleSize/2, 
                element.y + element.height - handleSize/2, 
                handleSize, 
                handleSize
            );
            ctx.restore();
        }
        
        if (element.modifiedImage) {
            ctx.drawImage(element.modifiedImage, element.x, element.y);
        } else {
            ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
        }
    });
}

/**
 * Samples color from the background at specified coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {string} RGB color value
 */
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

/**
 * Coordinate System Utilities
 * Handles conversion between screen coordinates and canvas coordinates
 * accounting for zoom level while keeping canvas at 100% internal size
 */

/**
 * Converts screen coordinates to canvas coordinates
 * @param {MouseEvent} event - Mouse event
 * @returns {Object} Canvas coordinates {x, y}
 */
function getCanvasCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    
    // Convert screen coordinates to canvas coordinates
    // Since visual zoom is applied via CSS transform, we need to account for it
    const canvasX = (event.clientX - rect.left) / zoomLevel;
    const canvasY = (event.clientY - rect.top) / zoomLevel;
    
    return {
        x: Math.round(canvasX),
        y: Math.round(canvasY)
    };
}

/**
 * Converts canvas coordinates to screen coordinates  
 * @param {number} canvasX - Canvas X coordinate
 * @param {number} canvasY - Canvas Y coordinate
 * @returns {Object} Screen coordinates {x, y}
 */
function getScreenCoordinates(canvasX, canvasY) {
    const rect = canvas.getBoundingClientRect();
    
    return {
        x: Math.round(rect.left + (canvasX * zoomLevel)),
        y: Math.round(rect.top + (canvasY * zoomLevel))
    };
}
/**
 * Mouse event handlers for canvas interaction
 */
canvas.addEventListener('mousedown', function(e) {
    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;

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

    if (currentMode === 'move' && selectedElement?.type === 'image') {
        const handleSize = 15;
        
        if (x >= selectedElement.x + selectedElement.width - handleSize && 
            y >= selectedElement.y + selectedElement.height - handleSize) {
            isResizing = 'br';
        } else if (x >= selectedElement.x + selectedElement.width - handleSize && 
                 y <= selectedElement.y + handleSize) {
            isResizing = 'tr';
        } else if (x <= selectedElement.x + handleSize && 
                 y >= selectedElement.y + selectedElement.height - handleSize) {
            isResizing = 'bl';
        } else {
            isDragging = true;
            isResizing = false;
        }
    }

    if (currentMode === 'move') {
        selectedElement = null;
        
        for (let i = imageElements.length - 1; i >= 0; i--) {
            const element = imageElements[i];
            if (x >= element.x && x <= element.x + element.width &&
                y >= element.y && y <= element.y + element.height) {
                selectedElement = element;
                
                if (x >= element.x + element.width - 10 && y >= element.y + element.height - 10) {
                    isResizing = 'br';
                } else if (x >= element.x + element.width - 10 && y <= element.y + 10) {
                    isResizing = 'tr';
                } else if (x <= element.x + 10 && y >= element.y + element.height - 10) {
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
        
        if (!selectedElement) {
            for (let i = textElements.length - 1; i >= 0; i--) {
                const element = textElements[i];
                const fontWithFallbacks = getFontWithFallbacks(element.fontFamily);
                ctx.font = `${element.fontSize}px ${fontWithFallbacks}`;
                const metrics = ctx.measureText(element.text);
                
                let textX = element.x;
                let textWidth = metrics.width;
                
                // Adjust hit detection for center-aligned variable text
                if (element.isVariable) {
                    textX = element.x - metrics.width/2;
                }
                
                if (x >= textX && x <= textX + textWidth &&
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
    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;
    
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
                const aspectRatio = selectedElement.image.width / selectedElement.image.height;
                const newWidth = Math.max(20, x - selectedElement.x);
                selectedElement.width = newWidth;
                selectedElement.height = newWidth / aspectRatio;
            } else if (isResizing === 'tr') {
                const aspectRatio = selectedElement.image.width / selectedElement.image.height;
                const newWidth = Math.max(20, x - selectedElement.x);
                selectedElement.width = newWidth;
                const newHeight = newWidth / aspectRatio;
                selectedElement.y = selectedElement.y + selectedElement.height - newHeight;
                selectedElement.height = newHeight;
            } else if (isResizing === 'bl') {
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

/**
 * Brush tool functions
 */
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

    imageElements.forEach(element => {
        if (element.type === 'image') {
            if (x >= element.x && x <= element.x + element.width &&
                y >= element.y && y <= element.y + element.height) {
                
                if (!element.modifiedImage) {
                    element.modifiedImage = document.createElement('canvas');
                    element.modifiedImage.width = element.width;
                    element.modifiedImage.height = element.height;
                    const modImgCtx = element.modifiedImage.getContext('2d');
                    modImgCtx.drawImage(element.image, 0, 0, element.width, element.height);
                }
                
                const modImgCtx = element.modifiedImage.getContext('2d');
                modImgCtx.globalCompositeOperation = 'destination-out';
                modImgCtx.beginPath();
                const localX = x - element.x;
                const localY = y - element.y;
                modImgCtx.arc(localX, localY, brushSize / 2, 0, 2 * Math.PI);
                modImgCtx.fill();
                
                if (lastBrushX !== null && lastBrushY !== null) {
                    const lastLocalX = lastBrushX - element.x;
                    const lastLocalY = lastBrushY - element.y;
                    modImgCtx.lineWidth = brushSize;
                    modImgCtx.lineCap = 'round';
                    modImgCtx.beginPath();
                    modImgCtx.moveTo(lastLocalX, lastLocalY);
                    modImgCtx.lineTo(localX, localY);
                    modImgCtx.stroke();
                }
            }
        }
    });

    lastBrushX = x;
    lastBrushY = y;
    if (brushStrokes.length > 0) {
        brushStrokes[brushStrokes.length - 1].push({x, y, size: brushSize, color: sampledColor});
    }
    redraw();
}

function endBrushStroke() {
    // Logic for ending a brush stroke
}

/**
 * Undoes the last brush stroke
 */
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

/**
 * Shows the edit dialog for adding text at a specific position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function showEditDialog(x, y) {
    editingPosition = { x: x, y: y };
    const rect = canvas.getBoundingClientRect();
    editOverlay.style.left = Math.min(rect.left + x + 10, window.innerWidth - 350) + 'px';
    editOverlay.style.top = Math.max(rect.top + y - 100, 10) + 'px';
    editOverlay.style.display = 'block';
    document.getElementById('editInput').value = '';
    document.getElementById('editInput').focus();
}

/**
 * Confirms adding text from the edit dialog
 */
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

/**
 * Creates a variable from the edit dialog
 */
function makeVariable() {
    if (editingPosition) {
        let varName = prompt("Enter variable name (e.g., NAME, DATE):", "NAME");
        if (!varName) return;
        
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

/**
 * Cancels the edit dialog
 */
function cancelEdit() {
    editOverlay.style.display = 'none';
    editingPosition = null;
}

/**
 * Generates multiple certificates with variable data and downloads them as a zip file
 */
async function generateCertificates() {
    const variableNames = [...new Set(textElements.filter(e => e.isVariable).map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1]))];
    
    if (variableNames.length === 0) {
        showNotification("Please add at least one variable field.", 'error');
        return;
    }
    
    if (!backgroundImage && !modifiedBackground) {
        showNotification("Please upload a template first.", 'error');
        return;
    }
    
    const tableInputs = Array.from(variableFieldsContainer.querySelectorAll('input'));
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
    
    // Create a new JSZip instance
    const zip = new JSZip();
    
    try {
        // Generate all certificates
        for (let i = 0; i < rowsData.length; i++) {
            const rowData = rowsData[i];
            const certificateBlob = await generateSingleCertificateAsBlob(rowData);
            const fileName = Object.values(rowData).filter(Boolean).join('_') || `certificate_${i + 1}`;
            const sanitizedFileName = `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
            
            // Add the certificate to the zip
            zip.file(sanitizedFileName, certificateBlob);
            
            // Update progress
            showNotification(`Generated certificate ${i + 1} of ${rowsData.length}...`, 'info');
        }
        
        // Generate and download the zip file
        const content = await zip.generateAsync({type:"blob"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `certificates_${new Date().toISOString().slice(0,10)}.zip`;
        link.click();
        
        showNotification(`All ${rowsData.length} certificates generated and downloaded as zip!`, 'success');
        
    } catch (error) {
        console.error('Error generating certificates:', error);
        showNotification('Error generating certificates. Please try again.', 'error');
    }
}

/**
 * Generates a single certificate with variable data and returns it as a blob
 * @param {Object} vars - Variable data for replacement
 * @returns {Blob} Certificate image as blob
 */
function generateSingleCertificateAsBlob(vars) {
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

    if (bgSource) {
        tempCtx.drawImage(bgSource, 0, 0, exportWidth, exportHeight);
    } else {
        tempCtx.fillStyle = '#fff';
        tempCtx.fillRect(0, 0, exportWidth, exportHeight);
    }

    textElements.forEach(element => {
        tempCtx.save();
        const fontWithFallbacks = getFontWithFallbacks(element.fontFamily);
        tempCtx.font = `${element.fontSize * scaleFactor}px ${fontWithFallbacks}`;
        tempCtx.fillStyle = element.color;
        tempCtx.textBaseline = 'top';
        
        // Set text alignment based on the element's alignment property
        tempCtx.textAlign = element.alignment || 'center';
        
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

    imageElements.forEach(element => {
        tempCtx.save();
        const sourceImage = element.modifiedImage || element.image;
        tempCtx.drawImage(
            sourceImage,
            element.x * scaleFactor,
            element.y * scaleFactor,
            element.width * scaleFactor,
            element.height * scaleFactor
        );
        tempCtx.restore();
    });

    // Convert canvas to blob
    return new Promise((resolve) => {
        tempCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.95);
    });
}

/**
 * Generates a single certificate with variable data
 * @param {Object} vars - Variable data for replacement
 */
function generateSingleCertificateWithVars(vars) {
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

    if (bgSource) {
        tempCtx.drawImage(bgSource, 0, 0, exportWidth, exportHeight);
    } else {
        tempCtx.fillStyle = '#fff';
        tempCtx.fillRect(0, 0, exportWidth, exportHeight);
    }

    textElements.forEach(element => {
        tempCtx.save();
        const fontWithFallbacks = getFontWithFallbacks(element.fontFamily);
        tempCtx.font = `${element.fontSize * scaleFactor}px ${fontWithFallbacks}`;
        tempCtx.fillStyle = element.color;
        tempCtx.textBaseline = 'top';
        
        // Set text alignment based on the element's alignment property
        tempCtx.textAlign = element.alignment || 'center';
        
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

    imageElements.forEach(element => {
        tempCtx.save();
        const sourceImage = element.modifiedImage || element.image;
        tempCtx.drawImage(
            sourceImage,
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

/**
 * Downloads the current canvas as an image
 */
function downloadCanvasImage() {
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

    if (bgSource) {
        exportCtx.drawImage(bgSource, 0, 0, exportWidth, exportHeight);
    } else {
        exportCtx.fillStyle = '#fff';
        exportCtx.fillRect(0, 0, exportWidth, exportHeight);
    }

    textElements.forEach(el => {
        exportCtx.save();
        const fontWithFallbacks = getFontWithFallbacks(el.fontFamily);
        exportCtx.font = `${el.fontSize * scaleFactor}px ${fontWithFallbacks}`;
        exportCtx.fillStyle = el.color;
        exportCtx.textBaseline = 'top';
        
        // Set text alignment based on the element's alignment property
        exportCtx.textAlign = el.alignment || 'center';
        
        exportCtx.fillText(el.text, el.x * scaleFactor, el.y * scaleFactor);
        exportCtx.restore();
    });
    
    imageElements.forEach(el => {
        exportCtx.save();
        const sourceImage = el.modifiedImage || el.image;
        exportCtx.drawImage(
            sourceImage,
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

/**
 * Keyboard event handlers
 */
document.addEventListener('keydown', function(e) {
    if (e.key === 'Delete' && selectedElement) {
        deleteSelected();
    }
    if (e.key === 'Escape') {
        cancelEdit();
    }
    
    // Zoom shortcuts (Ctrl/Cmd + Plus/Minus/0)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            zoomIn();
        } else if (e.key === '-') {
            e.preventDefault();
            zoomOut();
        } else if (e.key === '0') {
            e.preventDefault();
            resetZoom();
        } else if (e.key === 'f' || e.key === 'F') {
            // Ctrl+F: Re-fit template to optimal size
            e.preventDefault();
            if (backgroundImage) {
                // Get original dimensions from background
                const tempImg = new Image();
                tempImg.onload = function() {
                    autoFitTemplate(tempImg);
                };
                if (modifiedBackground) {
                    tempImg.src = modifiedBackground.toDataURL();
                } else {
                    tempImg.src = backgroundImage.src;
                }
            }
        }
    }
    
    // Scroll shortcuts (Arrow keys when zoomed)
    if (zoomLevel > 1.1 && !e.ctrlKey && !e.metaKey) {
        const workspace = document.querySelector('.canvas-workspace');
        const scrollStep = 50;
        
        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                workspace.scrollTop -= scrollStep;
                break;
            case 'ArrowDown':
                e.preventDefault();
                workspace.scrollTop += scrollStep;
                break;
            case 'ArrowLeft':
                e.preventDefault();
                workspace.scrollLeft -= scrollStep;
                break;
            case 'ArrowRight':
                e.preventDefault();
                workspace.scrollLeft += scrollStep;
                break;
        }
    }
});

document.getElementById('editInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        confirmEdit();
    }
});

/**
 * CSV file processing functionality
 */
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

/**
 * Processes uploaded CSV files and populates variable data
 */
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

            variableFieldsContainer.innerHTML = "";
            const heading = document.createElement('h3');
            heading.textContent = 'Variable Data';
            variableFieldsContainer.appendChild(heading);

            const table = document.createElement('table');
            table.className = 'variable-table';

            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<th>Sr. No.</th>` + 
                variableNames.map(v => `<th>${v}</th>`).join('');
            table.appendChild(headerRow);

            rows.forEach((rowData, index) => {
                const dataRow = document.createElement('tr');
                dataRow.innerHTML = `<td>${index + 1}</td>` + 
                    variableNames.map((v, i) => 
                        `<td><input type="text" data-var="${v}" data-row="${index}" value="${rowData[i] || ''}"></td>`
                    ).join('');
                table.appendChild(dataRow);
            });

            const finalBlankRow = document.createElement('tr');
            finalBlankRow.innerHTML = `<td>${rows.length + 1}</td>` + 
                variableNames.map((v, i) => 
                    `<td><input type="text" data-var="${v}" data-row="${rows.length}" 
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

/**
 * Parses CSV data with proper handling of quoted fields
 * @param {string} csv - CSV data string
 * @returns {Array} Parsed CSV rows
 */
function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
        return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
                  .map(cell => cell.replace(/^"|"$/g, '').trim());
    });
}

/**
 * Processes CSV data into the variable input table
 * @param {string} csv - CSV data string
 */
function processCSVData(csv) {
    const rows = csv.split('\n').map(row => row.split(',').map(cell => cell.trim()));
    const variableNames = [...new Set(textElements.filter(e => e.isVariable).map(e => e.text.match(/\{\{(.+?)\}\}/)?.[1]))];

    variableFieldsContainer.innerHTML = "";

    const table = document.createElement('table');
    table.className = 'variable-table';

    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th>Sr. No.</th>` + variableNames.map(v => `<th>${v}</th>`).join('');
    table.appendChild(headerRow);

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

/**
 * Custom cursor styles for different interaction modes
 */
const style = document.createElement('style');
style.textContent = `
    canvas.resize-bottom-right { cursor: nwse-resize; }
    canvas.resize-top-right { cursor: nesw-resize; }
    canvas.resize-bottom-left { cursor: nesw-resize; }
    canvas.move { cursor: move; }
`;
document.head.appendChild(style);

/**
 * Resets the application state to initial values
 */
function resetApplicationState() {
    // Reset application state variables
    backgroundImage = null;
    modifiedBackground = null;
    textElements = [];
    imageElements = [];
    selectedElement = null;
    isDragging = false;
    isResizing = false;
    dragOffset = { x: 0, y: 0 };
    editingPosition = null;
    brushStrokes = [];
    currentMode = 'move';
    zoomLevel = 1;
    signatures = [];
    selectedSignature = null;
    
    // Reset brush tool state
    isBrushing = false;
    lastBrushX = 0;
    lastBrushY = 0;
    sampledColor = '#ffffff';
    colorSampled = false;
    
    // Reset UI elements
    const variableFieldsContainer = document.getElementById('variableFieldsContainer');
    if (variableFieldsContainer) {
        variableFieldsContainer.innerHTML = `
            <div class="no-variables">
                <i class="bi bi-info-circle text-muted"></i>
                <p class="text-muted mb-0">No variables added yet</p>
                <small class="text-muted">Add variables to customize each certificate</small>
            </div>
        `;
    }
    
    // Reset form inputs
    const textContentInput = document.getElementById('textContent');
    const fontFamilyInput = document.getElementById('fontFamily');
    const fontSizeInput = document.getElementById('fontSize');
    const colorInput = document.getElementById('textColor');
    
    if (textContentInput) textContentInput.value = 'Sample Text';
    if (fontFamilyInput) fontFamilyInput.value = 'Cinzel';
    if (fontSizeInput) fontSizeInput.value = '24';
    if (colorInput) colorInput.value = '#000000';
    
    // Reset signature list
    updateSignatureList();
    
    // Reset selected element display
    updateSidebarForSelection();
    
    // Reset zoom
    updateZoomDisplay();
    
    // Reset template upload overlay
    updateTemplateUploadOverlay();
    
    // Reset mode to move
    const moveMode = document.getElementById('moveMode');
    if (moveMode) {
        moveMode.checked = true;
        currentMode = 'move';
        updateCursor();
        
        // Hide brush controls
        const brushControls = document.getElementById('brushControls');
        if (brushControls) brushControls.style.display = 'none';
    }
    
    // Reset CSV status
    const csvStatus = document.getElementById('csvStatus');
    if (csvStatus) {
        csvStatus.textContent = '';
        csvStatus.style.color = '';
    }
    
    // Disable buttons that require selection
    const deleteBtn = document.getElementById('deleteBtn');
    const addSignatureBtn = document.getElementById('addSignatureBtn');
    if (deleteBtn) deleteBtn.disabled = true;
    if (addSignatureBtn) addSignatureBtn.disabled = true;
    
    // Hide edit overlay
    const editOverlay = document.getElementById('editOverlay');
    if (editOverlay) editOverlay.style.display = 'none';
}

/**
 * Ensures fonts are loaded before use
 */
async function loadFonts() {
    if (document.fonts && document.fonts.load) {
        try {
            // Load the Google Fonts we're using
            await document.fonts.load('16px "Cinzel"');
            await document.fonts.load('16px "Playfair Display"');
            await document.fonts.load('16px "Cormorant Garamond"');
            await document.fonts.load('16px "Libre Baskerville"');
            await document.fonts.load('16px "Crimson Text"');
            await document.fonts.load('16px "Dancing Script"');
            await document.fonts.load('16px "Great Vibes"');
            
            console.log('Fonts loaded successfully');
        } catch (error) {
            console.warn('Some fonts may not have loaded:', error);
        }
    }
}

/**
 * Checks if a font is available
 * @param {string} fontFamily - Font family to check
 * @returns {boolean} Whether the font is available
 */
function isFontAvailable(fontFamily) {
    if (!document.fonts || !document.fonts.check) return true; // Assume available if API not supported
    
    try {
        return document.fonts.check(`16px "${fontFamily}"`);
    } catch (error) {
        return true; // Assume available if check fails
    }
}

/**
 * Application initialization

 */
updateCursor();
updateSidebarForSelection();
updateTemplateUploadOverlay();

// Initialize canvas with a clean background
ctx.fillStyle = '#f8fafc';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Load fonts and show status
loadFonts().then(() => {
    showNotification('All decorative fonts loaded successfully!', 'success');
}).catch(() => {
    showNotification('Some fonts may not be available on this system', 'info');
});

document.getElementById('downloadBtn').addEventListener('click', generateCertificates);

/**
 * Sets the alignment of the selected text or variable element and triggers a redraw
 * @param {string} alignment - The alignment value (e.g., 'left', 'center', 'right')
 */
function setAlignment(alignment) {
    if (selectedElement) {
        selectedElement.alignment = alignment;
        redraw();
    }
}
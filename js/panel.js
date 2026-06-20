/**
 * ============================================================
 * BALANCEO DE CARGAS ELÉCTRICAS - Panel ECA
 * Lógica del panel unifilar (canvas)
 * Desarrollado por ECA
 * © 2026 ECA - Todos los derechos reservados
 * ============================================================
 */

var Panel = {
  posMap: {},
  faseGlobal: 'ABC',
  numPos: 84,
  canvasDrawPending: false,

  // ============================================
  // LÓGICA DE POSICIÓN
  // ============================================

  faseDePosicion: function(pos, faseGlobal) {
    var bloque = Math.floor((pos - 1) / 2);
    if (faseGlobal === 'ABC') {
      return ['A', 'B', 'C'][bloque % 3];
    } else if (faseGlobal === 'AB') {
      return ['A', 'B'][bloque % 2];
    } else if (faseGlobal === 'BC') {
      return ['B', 'C'][bloque % 2];
    } else if (faseGlobal === 'AC') {
      return ['A', 'C'][bloque % 2];
    } else {
      return faseGlobal;
    }
  },

  encontrarPosicion: function(tipo, faseAsignada, faseGlobal, ocupadas, NUM_POS) {
    tipo = parseInt(tipo);

    if (tipo === 1) {
      for (var p = 1; p <= NUM_POS; p++) {
        if (ocupadas.has(p)) continue;
        if (this.faseDePosicion(p, faseGlobal) === faseAsignada) return [p];
      }
    } else if (tipo === 2) {
      var fasesReq = faseAsignada.split('').sort().join('');
      var maxBloque = Math.floor((NUM_POS - 1) / 2);
      var fallback2 = null;

      for (var b = 0; b < maxBloque; b++) {
        var f1 = this.faseDePosicion(b * 2 + 1, faseGlobal);
        var f2 = this.faseDePosicion((b + 1) * 2 + 1, faseGlobal);
        var pair = [f1, f2].sort().join('');
        if (pair !== fasesReq) continue;

        var p1a = b * 2 + 1, p1b = b * 2 + 2;
        var p2a = (b + 1) * 2 + 1, p2b = (b + 1) * 2 + 2;

        if (!ocupadas.has(p1a) && !ocupadas.has(p2a)) return [p1a, p2a];
        if (!ocupadas.has(p1b) && !ocupadas.has(p2b)) return [p1b, p2b];

        if (!fallback2) {
          var freeIn1 = [p1a, p1b].find(function(p) { return !ocupadas.has(p); });
          var freeIn2 = [p2a, p2b].find(function(p) { return !ocupadas.has(p); });
          if (freeIn1 !== undefined && freeIn2 !== undefined) {
            fallback2 = [freeIn1, freeIn2];
          }
        }
      }
      if (fallback2) return fallback2;

    } else if (tipo === 3) {
      if (faseGlobal !== 'ABC') return null;
      var maxBloque = Math.floor((NUM_POS - 1) / 2);
      var fallback3 = null;

      for (var b = 0; b <= maxBloque - 2; b++) {
        var f1 = this.faseDePosicion(b * 2 + 1, faseGlobal);
        var f2 = this.faseDePosicion((b + 1) * 2 + 1, faseGlobal);
        var f3 = this.faseDePosicion((b + 2) * 2 + 1, faseGlobal);
        var trio = [f1, f2, f3].sort().join('');
        if (trio !== 'ABC') continue;

        var p1a = b * 2 + 1, p1b = b * 2 + 2;
        var p2a = (b + 1) * 2 + 1, p2b = (b + 1) * 2 + 2;
        var p3a = (b + 2) * 2 + 1, p3b = (b + 2) * 2 + 2;

        if (!ocupadas.has(p1a) && !ocupadas.has(p2a) && !ocupadas.has(p3a)) return [p1a, p2a, p3a];
        if (!ocupadas.has(p1b) && !ocupadas.has(p2b) && !ocupadas.has(p3b)) return [p1b, p2b, p3b];

        if (!fallback3) {
          var freeIn1 = [p1a, p1b].find(function(p) { return !ocupadas.has(p); });
          var freeIn2 = [p2a, p2b].find(function(p) { return !ocupadas.has(p); });
          var freeIn3 = [p3a, p3b].find(function(p) { return !ocupadas.has(p); });
          if (freeIn1 !== undefined && freeIn2 !== undefined && freeIn3 !== undefined) {
            fallback3 = [freeIn1, freeIn2, freeIn3];
          }
        }
      }
      if (fallback3) return fallback3;
    }
    return null;
  },

  // ============================================
  // RENDERIZADO DEL CANVAS - VERSIÓN MEJORADA
  // ============================================

  render: function(faseGlobal, NUM_POS) {
    var canvas = document.getElementById('panel-canvas');
    if (!canvas) return;
    
    var configEl = document.getElementById('panel-config-label');
    if (configEl) configEl.textContent = '(' + faseGlobal + ')';

    // CONSTRUIR POSMAP CON TODA LA INFORMACIÓN
    var posMap = {};
    var maxCarga = 0;
    
    console.log('=== RENDERIZANDO PANEL ===');
    
    for (var i = 0; i < APP.NUM_FILAS; i++) {
      if (!posiciones[i]) continue;
      
      // Obtener datos de la fila
      var cargaEl = document.getElementById('carga-' + i);
      var descEl = document.getElementById('desc-' + i);
      var tipoEl = document.getElementById('tipo-' + i);
      
      var carga = cargaEl ? parseFloat(cargaEl.value) || 0 : 0;
      var desc = descEl ? descEl.value || '' : '';
      var tipo = tipoEl ? tipoEl.value : '';
      var fase = asignaciones[i] || null;
      
      if (!fase || carga <= 0) continue;
      if (carga > maxCarga) maxCarga = carga;
      
      var itm = getITM(carga);
      
      console.log('Circuito ' + (i+1) + ': fase=' + fase + ', carga=' + carga + 'A, desc="' + desc + '"');
      
      posiciones[i].forEach(function(p) {
        posMap[p] = { 
          idx: i, 
          fase: fase, 
          carga: carga, 
          itm: itm,
          desc: desc || 'C' + (i+1),
          tipo: tipo
        };
      });
    }

    console.log('Circuitos encontrados:', Object.keys(posMap).length);
    console.log('maxCarga:', maxCarga);

    // Calcular totalFilas
    var lastOccupied = 0;
    for (var p in posMap) {
      if (parseInt(p) > lastOccupied) lastOccupied = parseInt(p);
    }
    var blockSize = faseGlobal === 'ABC' ? 6 : faseGlobal.length === 2 ? 4 : 2;
    var minRows = blockSize * 2;
    var totalPos = Math.max(
      Math.ceil(lastOccupied / blockSize) * blockSize + blockSize,
      minRows
    );
    var totalFilas = Math.ceil(Math.min(totalPos, NUM_POS) / 2);

    // Geometría - más espacio para más información
    var PAD_TOP = 56;
    var PAD_BOTTOM = 36;
    var PAD_LEFT = 20;
    var PAD_RIGHT = 20;
    var ROW_H = 30; // Más alto para 5 columnas
    var DPR = window.devicePixelRatio || 1;
    var W = canvas.offsetWidth || 860;
    var H = PAD_TOP + totalFilas * ROW_H + PAD_BOTTOM;

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, W, H);

    // Fondo
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#fafaf8');
    grad.addColorStop(1, '#f0efec');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Posición X de cada barra
    var CENTER = W / 2;
    var BAR_GAP = 38;
    var barX = {};
    if (faseGlobal === 'ABC') {
      barX.A = CENTER - BAR_GAP;
      barX.B = CENTER;
      barX.C = CENTER + BAR_GAP;
    } else if (faseGlobal.length === 2) {
      var f0 = faseGlobal[0], f1 = faseGlobal[1];
      barX[f0] = CENTER - BAR_GAP / 2;
      barX[f1] = CENTER + BAR_GAP / 2;
    } else {
      barX[faseGlobal] = CENTER;
    }

    var barTop = PAD_TOP - 16;
    var barBottom = PAD_TOP + totalFilas * ROW_H + 6;
    var leftBarEdge = Math.min.apply(null, Object.values(barX));
    var rightBarEdge = Math.max.apply(null, Object.values(barX));
    var BOX_MARGIN = 22;
    var LABEL_W = leftBarEdge - PAD_LEFT - BOX_MARGIN;
    var LABEL_X_R = rightBarEdge + BOX_MARGIN;
    var LABEL_W_R = W - PAD_RIGHT - LABEL_X_R;

    // ============================================
    // BLOQUES DE FASE
    // ============================================
    for (var row = 0; row < totalFilas; row++) {
      var pos = row * 2 + 1;
      var phase = this.faseDePosicion(pos, faseGlobal);
      var col = FASE_COLORS[phase];
      if (!col) continue;
      
      var y = PAD_TOP + row * ROW_H;
      ctx.fillStyle = col.light + '40';
      ctx.beginPath();
      ctx.roundRect(PAD_LEFT + 2, y + 1, W - PAD_LEFT - PAD_RIGHT - 4, ROW_H - 2, 2);
      ctx.fill();
    }

    // ============================================
    // BARRAS VERTICALES
    // ============================================
    for (var ph in barX) {
      var x = barX[ph];
      var color = FASE_COLORS[ph]?.line || '#888';
      
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, barTop);
      ctx.lineTo(x, barBottom);
      ctx.stroke();
      
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 2, barTop + 4);
      ctx.lineTo(x - 2, barBottom - 4);
      ctx.stroke();
    }

    // ============================================
    // CABECERA DE FASE
    // ============================================
    ctx.shadowColor = 'transparent';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    var headerBadgeColors = { A: '#1a1a18', B: '#c0392b', C: '#1a5fa5' };
    for (var ph in barX) {
      var x = barX[ph];
      var badgeColor = headerBadgeColors[ph] || FASE_COLORS[ph]?.fill || '#888';
      
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.roundRect(x - 16, 8, 32, 26, 6);
      ctx.fill();
      
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(x - 14, 10, 28, 22, 4);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(ph, x, 27);
    }

    // ============================================
    // LÍNEAS DIVISORIAS
    // ============================================
    ctx.shadowColor = 'transparent';
    for (var row = 0; row < totalFilas - 1; row++) {
      var lineY = PAD_TOP + (row + 1) * ROW_H;
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT + 6, lineY);
      ctx.lineTo(W - PAD_RIGHT - 6, lineY);
      ctx.stroke();
    }

    // ============================================
    // DIBUJAR BREAKERS
    // ============================================
    for (var row = 0; row < totalFilas; row++) {
      var midY = PAD_TOP + row * ROW_H + ROW_H / 2;
      
      var posLeft = row * 2 + 1;
      var slotLeft = posMap[posLeft];
      this.drawBreaker(ctx, slotLeft, posLeft, faseGlobal, midY, 'left',
        PAD_LEFT, LABEL_W, barX, maxCarga);

      var posRight = row * 2 + 2;
      var slotRight = posMap[posRight];
      this.drawBreaker(ctx, slotRight, posRight, faseGlobal, midY, 'right',
        LABEL_X_R, LABEL_W_R, barX, maxCarga);
    }

    // ============================================
    // BARRA DE TIERRA
    // ============================================
    var groundY = barBottom + 18;
    ctx.shadowColor = 'transparent';
    
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT + 30, groundY);
    ctx.lineTo(W - PAD_RIGHT - 30, groundY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = '#999996';
    ctx.textAlign = 'center';
    ctx.fillText('⏚  Neutro / Tierra', W / 2, groundY + 18);
    
    for (var i = 0; i < 6; i++) {
      var tx = PAD_LEFT + 60 + i * ((W - PAD_LEFT - PAD_RIGHT - 120) / 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, groundY - 6);
      ctx.lineTo(tx, groundY + 6);
      ctx.stroke();
    }
  },

  // ============================================
  // DIBUJAR BREAKER - CON CORRIENTE Y DESCRIPCIÓN
  // ============================================
  
  drawBreaker: function(ctx, slot, pos, faseGlobal, midY, side,
      labelX, labelW, barX, maxCarga) {

    var natPhase = this.faseDePosicion(pos, faseGlobal);
    var dotX = barX[natPhase];
    if (dotX === undefined) return;

    var labelEndX = side === 'left' ? labelX + labelW : labelX;

    if (slot) {
      var fs = slot.fase;
      var carga = slot.carga || 0;
      var itm = slot.itm || '—';
      var desc = slot.desc || '';
      var wireColor = FASE_COLORS[fs]?.line || FASE_MULTI_COLORS[fs] || '#888';
      var boxCol = FASE_BADGE_COLORS[fs] || { bg: '#f0f0ee', text: '#444', border: '#aaa' };
      
      // ============================================
      // CABLE DE CONEXIÓN
      // ============================================
      ctx.shadowColor = 'transparent';
      
      ctx.shadowColor = 'rgba(0,0,0,0.06)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
      
      ctx.strokeStyle = wireColor;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(labelEndX, midY);
      ctx.lineTo(dotX, midY);
      ctx.stroke();
      
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(labelEndX + 2, midY - 1);
      ctx.lineTo(dotX - 2, midY - 1);
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      ctx.shadowColor = 'transparent';

      // ============================================
      // PUNTO DE CONEXIÓN
      // ============================================
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      
      ctx.fillStyle = wireColor;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dotX, midY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(dotX - 1.5, midY - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // ============================================
      // TARJETA DEL CIRCUITO
      // ============================================
      ctx.shadowColor = 'transparent';
      
      var BOX_H = 22;
      var BOX_Y = midY - BOX_H / 2;
      var RADIUS = 4;
      var POS_W = 20;
      var GAP = 4;

      var boxX, boxW;
      if (side === 'left') {
        boxX = labelX + POS_W + GAP;
        boxW = labelW - POS_W - GAP - 2;
      } else {
        boxX = labelX + 2;
        boxW = labelW - POS_W - GAP - 2;
      }

      // Fondo de la tarjeta
      ctx.shadowColor = 'rgba(0,0,0,0.06)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
      
      ctx.fillStyle = boxCol.bg;
      ctx.beginPath();
      ctx.roundRect(boxX, BOX_Y, boxW, BOX_H, RADIUS);
      ctx.fill();
      
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = boxCol.border + '60';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(boxX, BOX_Y, boxW, BOX_H, RADIUS);
      ctx.stroke();

      // Número de posición
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.textAlign = side === 'left' ? 'left' : 'right';
      var numX = side === 'left' ? labelX + 3 : labelX + labelW - 3;
      ctx.fillText(pos, numX, midY + 4);

      // ============================================
      // CONTENIDO: 5 COLUMNAS
      // ============================================
      
      var itmText = itm !== '—' ? itm + 'A' : '—';
      var ampText = carga.toFixed(1) + 'A';
      var circText = 'C' + (slot.idx + 1);
      var phaseText = fs;
      var displayDesc = desc.length > 8 ? desc.substring(0, 8) + '…' : desc;
      
      // Posiciones de las columnas
      var colPositions;
      if (side === 'left') {
        // Izquierda: Circuito | Descripción | Corriente | ITM | Fase
        colPositions = [
          boxX + boxW * 0.08,   // Circuito
          boxX + boxW * 0.26,   // Descripción
          boxX + boxW * 0.48,   // Corriente
          boxX + boxW * 0.74,   // ITM
          boxX + boxW * 0.92    // Fase
        ];
        
        // Circuito
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillStyle = boxCol.text;
        ctx.textAlign = 'center';
        ctx.fillText(circText, colPositions[0], midY + 4);
        
        // Descripción
        ctx.font = '7px -apple-system, sans-serif';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText(displayDesc, colPositions[1], midY + 4);
        
        // CORRIENTE (destacada)
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillStyle = '#1a1a18';
        ctx.textAlign = 'center';
        ctx.fillText(ampText, colPositions[2], midY + 4);
        
        // ITM
        this.drawITM(ctx, colPositions[3], midY, itmText);
        
        // Fase
        ctx.font = 'bold 8px -apple-system, sans-serif';
        ctx.fillStyle = boxCol.border;
        ctx.textAlign = 'center';
        ctx.fillText(phaseText, colPositions[4], midY + 4);
        
      } else {
        // Derecha: Fase | ITM | Corriente | Descripción | Circuito
        colPositions = [
          boxX + boxW * 0.08,   // Fase
          boxX + boxW * 0.26,   // ITM
          boxX + boxW * 0.48,   // Corriente
          boxX + boxW * 0.74,   // Descripción
          boxX + boxW * 0.92    // Circuito
        ];
        
        // Fase
        ctx.font = 'bold 8px -apple-system, sans-serif';
        ctx.fillStyle = boxCol.border;
        ctx.textAlign = 'center';
        ctx.fillText(phaseText, colPositions[0], midY + 4);
        
        // ITM
        this.drawITM(ctx, colPositions[1], midY, itmText);
        
        // CORRIENTE (destacada)
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillStyle = '#1a1a18';
        ctx.textAlign = 'center';
        ctx.fillText(ampText, colPositions[2], midY + 4);
        
        // Descripción
        ctx.font = '7px -apple-system, sans-serif';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText(displayDesc, colPositions[3], midY + 4);
        
        // Circuito
        ctx.font = 'bold 9px -apple-system, sans-serif';
        ctx.fillStyle = boxCol.text;
        ctx.textAlign = 'center';
        ctx.fillText(circText, colPositions[4], midY + 4);
      }

      // ============================================
      // INDICADOR DE CARGA
      // ============================================
      if (maxCarga > 0 && carga > 0) {
        var barW = Math.max(4, (carga / maxCarga) * 24);
        var barY = BOX_Y + BOX_H + 2;
        var barColor = carga / maxCarga > 0.7 ? '#d85a30' : 
                       carga / maxCarga > 0.4 ? '#ba7517' : '#0db548';
        
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.beginPath();
        ctx.roundRect(boxX + boxW * 0.12, barY, boxW * 0.76, 2, 1);
        ctx.fill();
        
        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(boxX + boxW * 0.12, barY, Math.min(boxW * 0.76, barW), 2, 1);
        ctx.fill();
      }

    } else {
      // ============================================
      // SLOT VACÍO
      // ============================================
      ctx.shadowColor = 'transparent';
      
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(labelEndX, midY);
      ctx.lineTo(dotX, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      var natCol = FASE_COLORS[natPhase];
      ctx.strokeStyle = natCol ? natCol.line + '30' : 'rgba(0,0,0,0.10)';
      ctx.fillStyle = '#fafaf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(dotX, midY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '9px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.textAlign = side === 'left' ? 'left' : 'right';
      var numX = side === 'left' ? labelX + 4 : labelX + labelW - 4;
      ctx.fillText(pos, numX, midY + 4);
    }
  },
  
  // ============================================
  // UTILIDAD PARA DIBUJAR ITM
  // ============================================
  
  drawITM: function(ctx, x, midY, itmText) {
    var itmBadgeW = 28;
    var itmBadgeH = 12;
    var itmBadgeX = x - itmBadgeW / 2;
    var itmBadgeY = midY - itmBadgeH / 2;
    
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    
    ctx.fillStyle = '#2c2c2a';
    ctx.beginPath();
    ctx.roundRect(itmBadgeX, itmBadgeY, itmBadgeW, itmBadgeH, 3);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(itmBadgeX + 2, itmBadgeY + 1, itmBadgeW - 4, 3, 2);
    ctx.fill();
    
    ctx.font = 'bold 7px -apple-system, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(itmText, x, midY + 4);
  },

  renderDebounced: function() {
    if (this.canvasDrawPending) return;
    this.canvasDrawPending = true;
    var self = this;
    var faseGlobal = getFaseGlobal ? getFaseGlobal() : 'ABC';
    self.faseGlobal = faseGlobal;
    requestAnimationFrame(function() {
      self.render(self.faseGlobal, APP.NUM_FILAS * 2);
      self.canvasDrawPending = false;
    });
  }
};

// Forzar redibujado después de balancear
var originalBalancear = balancear;
balancear = function() {
  originalBalancear.apply(this, arguments);
  // Redibujar después de 500ms
  setTimeout(function() {
    Panel.renderDebounced();
  }, 500);
};

// También redibujar después de cargar ejemplo
var originalCargarEjemplo = cargarEjemplo;
cargarEjemplo = function() {
  originalCargarEjemplo.apply(this, arguments);
  setTimeout(function() {
    Panel.renderDebounced();
  }, 500);
};

// Polyfill para roundRect si no existe
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (r > w/2) r = w/2;
    if (r > h/2) r = h/2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}

// Inicializar con renderizado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      Panel.renderDebounced();
    }, 100);
  });
} else {
  setTimeout(function() {
    Panel.renderDebounced();
  }, 100);
}
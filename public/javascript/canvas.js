'use strict';

/* ~~~~~~~~~~~~~~~~~~~~~~~~ Global Variables ~~~~~~~~~~~~~~~~~~~~~~~~ */
let drawMode = 0;
let currentSize = 3;
let currentRGB = [0, 0, 0];

let drawingEvents = [];
let [prevX, prevY] = [0, 0];



/* ~~~~~~~~~~~~~~~~~~~~~~~~ HTML Elements ~~~~~~~~~~~~~~~~~~~~~~~~ */
const canvas1 = document.getElementById("canvas-1");
const guesscanvas1 = document.getElementById("guesscanvas-1");
const guesscanvas2 = document.getElementById("guesscanvas-2");

const ctx1 = canvas1.getContext("2d");
const gctx1 = guesscanvas1.getContext("2d");
const gctx2 = guesscanvas2.getContext("2d");

const undoButton = document.getElementById("undo-button");
const clearCanvasButton = document.getElementById("clear-button");
const colorSelect = document.getElementById('color-select');



/* ~~~~~~~~~~~~~~~~~~~~~~~~ General Setup ~~~~~~~~~~~~~~~~~~~~~~~~ */
canvas1.width = 200;
canvas1.height = 400;

guesscanvas1.width = 200;
guesscanvas1.height = 400;

guesscanvas1.width = 200;
guesscanvas1.height = 400;

ctx1.lineCap = "round";
gctx1.lineCap = "round";
gctx2.lineCap = "round";

const offsetPosToCanvasPos = (x, y) => [
  x / canvas1.offsetWidth * canvas1.width,
  y / canvas1.offsetHeight * canvas1.height
]

const offsetPosToCanvasPos1 = (x, y) => [
  x / guesscanvas1.offsetWidth * guesscanvas1.width,
  y / guesscanvas1.offsetHeight * guesscanvas1.height
]

const offsetPosToCanvasPos2 = (x, y) => [
  x / guesscanvas2.offsetWidth * guesscanvas2.width,
  y / guesscanvas2.offsetHeight * guesscanvas2.height
]


/* ~~~~~~~~~~~~ Scoreboard Setup ~~~~~~~~~~~~*/

const scorecanvas1 = document.getElementById("scorecanvas-1");
scorecanvas1.width = 200;
scorecanvas1.height = 400;

const scorecanvas2 = document.getElementById("scorecanvas-2");
scorecanvas1.width = 200;
scorecanvas1.height = 400;


const sctx1 = scorecanvas1.getContext("2d");
sctx1.lineCap = "round";

const sctx2 = scorecanvas2.getContext("2d");
sctx2.lineCap = "round";


const offsetPosToCanvasPos3 = (x, y) => [
  x / scorecanvas1.offsetWidth * scorecanvas1.width,
  y / scorecanvas1.offsetHeight * scorecanvas1.height
]

const offsetPosToCanvasPos4 = (x, y) => [
  x / scorecanvas2.offsetWidth * scorecanvas2.width,
  y / scorecanvas2.offsetHeight * scorecanvas2.height
]


/* ~~~~~~~~~~~~~~~~~~~~~~~~ Custom Canvas Cursor ~~~~~~~~~~~~~~~~~~~~~~~~ */
// Unfortunately, browsers do not give access to user zoom level:
// https://css-tricks.com/can-javascript-detect-the-browsers-zoom-level/
// The best I could do is use the original value of this and assume it means 100%.

const updateCursor = () => {
  if (drawMode === 0) {
    const canvasWidth = canvas1.getBoundingClientRect().width;
    const radius = Math.round(currentSize / 2 * canvasWidth / canvas1.width);

    const newStyle = `url(\"data:image/svg+xml;utf8, \
      <svg xmlns=\\"http://www.w3.org/2000/svg\\" version=\\"1.1\\" width=\\"${radius * 2 + 2}\\" height=\\"${radius * 2 + 2}\\">\
      <circle cx=\\"${radius}\\" cy=\\"${radius}\\" r=\\"${radius}\\" \
      style=\\"fill: rgb(${currentRGB[0]},${currentRGB[1]},${currentRGB[2]}); stroke: rgb(0,0,0);\\"/>\
      </svg>\") ${radius + 1} ${radius + 1}, auto`
    canvas1.style.cursor = newStyle;
  } else if (drawMode === 1) {
    canvas1.style.cursor = 'url(paintbucket.svg) 24 24, auto';
  }
}



/* ~~~~~~~~~~~~~~~~~~~~~~~~ Control Panel Event Handlers ~~~~~~~~~~~~~~~~~~~~~~~~ */
/**
 * Modes can be: 0 = draw; 1 = fill
 *
 * Called from index.html
 */
const setDrawMode = (newMode) => {
  drawMode = newMode;
  updateCursor();
}

/* ------------ Undo Button ------------ */
undoButton.onclick = e => {
  e.preventDefault();
  undoDrawingEvents();
  socket.emit('undoEvent', drawingEvents, drawerNumber);
}

/* ------------ Clear Canvas Button ------------ */
clearCanvasButton.onclick = e => {
  e.preventDefault();
  clearCanvas1();
}

/* ------------ Color Select Slider ------------ */
const updateColor = () => {
  let newColor = colorSelect.value;
  currentRGB = [
    parseInt(newColor.slice(1, 3), 16),
    parseInt(newColor.slice(3, 5), 16),
    parseInt(newColor.slice(5, 7), 16)
  ];
  ctx1.strokeStyle = newColor;

  updateCursor();
}
colorSelect.addEventListener('change', updateColor);
updateColor();

/* ------------ Brush Size Slider ------------ */
const setBrushSize = (newSize) => {
  currentSize = newSize;
  ctx1.lineWidth = currentSize;

  updateCursor();
}
setBrushSize(3);



/* ~~~~~~~~~~~~~~~~~~~~~~~~ Drawing Events ~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ------------ Draw and Fill ------------ */
const findLastIndex = (list, fxn) => {
  for (let i = list.length - 1; i >= 0; i--) {
    if (fxn(list[i])) return i;
  }

  return -1;
}

const handleDrawingEvent = e => {
  switch (e.type) {
    case "draw":
      ctx1.strokeStyle = rgb2Hex(e.data.color[0], e.data.color[1], e.data.color[2]);
      ctx1.lineWidth = e.data.size;
      drawSegment(e.data.fromX, e.data.fromY, e.data.toX, e.data.toY);
      break;
    case "fill":
      floodFill(e.data.x, e.data.y, e.data.color);
      break;
    default:
      break;
  }
}

const storeBreakpointEvent = () => drawingEvents.push({ type: "breakpoint", data: {} });

const drawAndStore = (previousX, previousY, currentX, currentY) => {
  let newDrawingEvent = {
    type: "draw",
    data: {
      fromX: previousX,
      fromY: previousY,
      toX: currentX,
      toY: currentY,
      color: currentRGB,
      size: currentSize
    }
  }

  drawingEvents.push(newDrawingEvent);
  drawSegment(previousX, previousY, currentX, currentY);
  socket.emit('drawingUpdate', newDrawingEvent, drawerNumber);
}

const fillAndStore = (x, y, fillColor) => {
  let newDrawingEvent = {
    type: "fill",
    data: {
      x,
      y,
      color: fillColor
    }
  }

  drawingEvents.push(newDrawingEvent);
  floodFill(x, y, fillColor);
  socket.emit('drawingUpdate', newDrawingEvent, drawerNumber);
}

const drawSegment = (previousX, previousY, currentX, currentY) => {
  ctx1.beginPath(); // This empties the list of things to be drawn by stroke()
  ctx1.moveTo(previousX, previousY);
  ctx1.lineTo(currentX, currentY);
  ctx1.stroke();
}

/* ------------ Undo ------------ */
const undoDrawingEvents = () => {
  const lastIndex = Math.max(0, findLastIndex(drawingEvents, obj => obj.type === "breakpoint"));
  drawingEvents = drawingEvents.slice(0, lastIndex);

  ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
  ctx1.beginPath();
  for (let i = 0; i < drawingEvents.length; i++) {
    handleDrawingEvent(drawingEvents[i]);
  }
  ctx1.stroke();

  updateColor();
  setBrushSize(currentSize);
}

/* ------------ Clear Canvas ------------ */
const clearCanvas1 = () => {
  ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
  drawingEvents = []; //COULD make this be a clearCanvasEvent so it could be undone
  socket.emit('clearEvent', drawingEvents, drawerNumber);
}

// drawingEvent = {
//   type: "draw",
//   data: {
//     fromX: 20,
//     fromY: 30,
//     toX: 30,
//     toY: 40,
//     color: [255, 255, 255]
//     size: 30
//   }
// }
// fillEvent = {
//   type: "fill",
//   data: {
//     x: 3,
//     y: 4,
//     color: [255, 255, 255]
//   }
// }
// newLineEvent = {
//   type: "newAction",
//   data: {}
// }



/* ~~~~~~~~~~~~~~~~~~~~~~~~ Tracking User Inputs ~~~~~~~~~~~~~~~~~~~~~~~~ */
/* ------------ Mouse Inputs ------------ */
const updatePreviousPositions = (x, y) => {
  [prevX, prevY] = [x, y];
}

document.onmousemove = ({ pageX, pageY }) => {
  let canvas1Rect = canvas1.getBoundingClientRect(); //Could be moved, but would need to track resizes

  let [x, y] = [...offsetPosToCanvasPos(
    pageX - canvas1Rect.left - window.scrollX,
    pageY - canvas1Rect.top - window.scrollY
  )];

  updatePreviousPositions(x, y);
}

canvas1.onmouseleave = ({ offsetX, offsetY, buttons }) => {
  let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);
  if (buttons === 1 && drawMode === 0) {
    drawAndStore(prevX, prevY, canvasX, canvasY);
  }
}

canvas1.onmousemove = ({ offsetX, offsetY, buttons }) => {
  let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);

  if (buttons === 1 && drawMode === 0) {
    drawAndStore(prevX, prevY, canvasX, canvasY);
  }
}

// If the user just taps the mouse, this draws a dot.
canvas1.onmousedown = ({ offsetX, offsetY, buttons }) => {
  let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);

  if (buttons === 1) {
    storeBreakpointEvent();

    if (drawMode === 0) {
      drawAndStore(canvasX, canvasY, canvasX, canvasY);
    } else if (drawMode === 1) {
      fillAndStore(...[canvasX, canvasY].map(Math.round), [...currentRGB, 255]);
    }
  }
}

canvas1.oncontextmenu = () => false;

/* ------------ Touchscreen Inputs ------------ */
const getOffsetFromTouchEvent = ev => {
  let { targetTouches: { 0: { pageX, pageY } } } = ev;
  return {
    offsetX: pageX - ev.target.getBoundingClientRect().left,
    offsetY: pageY - ev.target.getBoundingClientRect().top
  };
}

canvas1.ontouchstart = ev => {
  ev.preventDefault();
  storeBreakpointEvent();

  let { offsetX, offsetY } = getOffsetFromTouchEvent(ev);
  let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);

  if (drawMode === 0) {
    drawAndStore(canvasX, canvasY, canvasX, canvasY);
    updatePreviousPositions(canvasX, canvasY);
  } else if (drawMode === 1) {
    fillAndStore(...[canvasX, canvasY].map(Math.round), [...currentRGB, 255]);
  }
}

canvas1.ontouchmove = ev => {
  ev.preventDefault();

  if (drawMode === 0) {
    let { offsetX, offsetY } = getOffsetFromTouchEvent(ev);
    let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);

    drawAndStore(prevX, prevY, canvasX, canvasY);
    updatePreviousPositions(canvasX, canvasY);
  }
}



/* ~~~~~~~~~~~~~~~~~~~~~~~~ Flood Fill Algorithm ~~~~~~~~~~~~~~~~~~~~~~~~ */
const pixelPos = (x, y, w) => (y * w + x) * 4;

const closeTo = (x1, x2, dist = 7) =>
  x1 >= x2 - dist && x1 <= x2 + dist;

const compareColor = (spreadColor, imgData, x, y, w, h) => {
  const startPos = pixelPos(x, y, w);
  return (
    x >= 0 && x < w &&
    y >= 0 && y < h &&
    closeTo(spreadColor[0], imgData.data[startPos + 0]) &&
    closeTo(spreadColor[1], imgData.data[startPos + 1]) &&
    closeTo(spreadColor[2], imgData.data[startPos + 2]) &&
    closeTo(spreadColor[3], imgData.data[startPos + 3])
  );
}

const setColor = (fillColor, imgData, x, y, w) => {
  const startPos = pixelPos(x, y, w);

  imgData.data[startPos + 0] = fillColor[0]
  imgData.data[startPos + 1] = fillColor[1]
  imgData.data[startPos + 2] = fillColor[2]
  imgData.data[startPos + 3] = 255 // Make sure the color is not transparent
}

// Adapted from: http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/
// ( Will we have problems with pixels starting out as transparent? )
const floodFill = (startX, startY, fillColor) => {
  const spreadColor = ctx1.getImageData(startX, startY, 1, 1).data;
  const w = canvas1.width;
  const h = canvas1.height;
  const imgData = ctx1.getImageData(0, 0, w, h);

  const pixelStack = [];

  let curX = startX;
  let curY = startY;

  if (compareColor(fillColor, imgData, startX, startY, w, h)) return;

  pixelStack.push([curX, curY]);

  while (pixelStack.length > 0) {
    let topAdd = true;
    let bottomAdd = true;
    [curX, curY] = pixelStack.pop();

    while (curX > 0 && compareColor(spreadColor, imgData, curX - 1, curY, w, h)) curX -= 1;

    while (curX < 200 && compareColor(spreadColor, imgData, curX, curY, w, h)) {
      setColor(fillColor, imgData, curX, curY, w);

      if (topAdd) {
        if (compareColor(spreadColor, imgData, curX, curY - 1, w, h)) {
          pixelStack.push([curX, curY - 1]);
          topAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY - 1, w, h)) topAdd = true;
      }

      if (bottomAdd) {
        if (compareColor(spreadColor, imgData, curX, curY + 1, w, h)) {
          pixelStack.push([curX, curY + 1]);
          bottomAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY + 1, w, h)) bottomAdd = true;
      }

      curX += 1;
    }
  }

  ctx1.putImageData(imgData, 0, 0);
}



/* ~~~~~~~~~~~~~~~~~~~~~~~~ Updating Guessers ~~~~~~~~~~~~~~~~~~~~~~~~ */
const handleDrawingEvent1 = e => {
  switch (e.type) {
    case "draw":
      gctx1.strokeStyle = rgb2Hex(e.data.color[0], e.data.color[1], e.data.color[2]);
      gctx1.lineWidth = e.data.size;
      drawSegment1(e.data.fromX, e.data.fromY, e.data.toX, e.data.toY);
      break;
    case "fill":
      floodFill1(e.data.x, e.data.y, e.data.color);
      break;
    default:
      break;
  }
}


const drawSegment1 = (previousX, previousY, currentX, currentY) => {
  gctx1.beginPath(); // This empties the list of things to be drawn by stroke()
  gctx1.moveTo(previousX, previousY);
  gctx1.lineTo(currentX, currentY);
  gctx1.stroke();
}

const floodFill1 = (startX, startY, fillColor) => {
  const spreadColor = gctx1.getImageData(startX, startY, 1, 1).data;
  const w = guesscanvas1.width;
  const h = guesscanvas1.height;
  const imgData = gctx1.getImageData(0, 0, w, h);

  const pixelStack = [];

  let curX = startX;
  let curY = startY;

  if (compareColor(fillColor, imgData, startX, startY, w, h)) return;

  pixelStack.push([curX, curY]);

  while (pixelStack.length > 0) {
    let topAdd = true;
    let bottomAdd = true;
    [curX, curY] = pixelStack.pop();

    while (curX > 0 && compareColor(spreadColor, imgData, curX - 1, curY, w, h)) curX -= 1;

    while (curX < 200 && compareColor(spreadColor, imgData, curX, curY, w, h)) {
      setColor(fillColor, imgData, curX, curY, w);

      if (topAdd) {
        if (compareColor(spreadColor, imgData, curX, curY - 1, w, h)) {
          pixelStack.push([curX, curY - 1]);
          topAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY - 1, w, h)) topAdd = true;
      }

      if (bottomAdd) {
        if (compareColor(spreadColor, imgData, curX, curY + 1, w, h)) {
          pixelStack.push([curX, curY + 1]);
          bottomAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY + 1, w, h)) bottomAdd = true;
      }

      curX += 1;
    }
  }

  gctx1.putImageData(imgData, 0, 0);
}

const handleDrawingEvent2 = e => {
  switch (e.type) {
    case "draw":
      gctx2.strokeStyle = rgb2Hex(e.data.color[0], e.data.color[1], e.data.color[2]);
      gctx2.lineWidth = e.data.size;
      drawSegment2(e.data.fromX, e.data.fromY, e.data.toX, e.data.toY);
      break;
    case "fill":
      floodFill2(e.data.x, e.data.y, e.data.color);
      break;
    default:
      break;
  }
}


const drawSegment2 = (previousX, previousY, currentX, currentY) => {
  gctx2.beginPath(); // This empties the list of things to be drawn by stroke()
  gctx2.moveTo(previousX, previousY);
  gctx2.lineTo(currentX, currentY);
  gctx2.stroke();
}

const floodFill2 = (startX, startY, fillColor) => {
  const spreadColor = gctx2.getImageData(startX, startY, 1, 1).data;
  const w = guesscanvas2.width;
  const h = guesscanvas2.height;
  const imgData = gctx2.getImageData(0, 0, w, h);

  const pixelStack = [];

  let curX = startX;
  let curY = startY;

  if (compareColor(fillColor, imgData, startX, startY, w, h)) return;

  pixelStack.push([curX, curY]);

  while (pixelStack.length > 0) {
    let topAdd = true;
    let bottomAdd = true;
    [curX, curY] = pixelStack.pop();

    while (curX > 0 && compareColor(spreadColor, imgData, curX - 1, curY, w, h)) curX -= 1;

    while (curX < 200 && compareColor(spreadColor, imgData, curX, curY, w, h)) {
      setColor(fillColor, imgData, curX, curY, w);

      if (topAdd) {
        if (compareColor(spreadColor, imgData, curX, curY - 1, w, h)) {
          pixelStack.push([curX, curY - 1]);
          topAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY - 1, w, h)) topAdd = true;
      }

      if (bottomAdd) {
        if (compareColor(spreadColor, imgData, curX, curY + 1, w, h)) {
          pixelStack.push([curX, curY + 1]);
          bottomAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY + 1, w, h)) bottomAdd = true;
      }

      curX += 1;
    }
  }

  gctx2.putImageData(imgData, 0, 0);
}


/* ~~~~~~~~~~~ Updating Scoreboard ~~~~~~~~~~~*/


const handleDrawingEvent3 = e => {
  switch (e.type) {
    case "draw":
      sctx1.strokeStyle = rgb2Hex(e.data.color[0], e.data.color[1], e.data.color[2]);
      sctx1.lineWidth = e.data.size;
      drawSegment3(e.data.fromX, e.data.fromY, e.data.toX, e.data.toY);
      break;
    case "fill":
      floodFill3(e.data.x, e.data.y, e.data.color);
      break;
    default:
      break;
  }
}


const drawSegment3 = (previousX, previousY, currentX, currentY) => {
  sctx1.beginPath(); // This empties the list of things to be drawn by stroke()
  sctx1.moveTo(previousX, previousY);
  sctx1.lineTo(currentX, currentY);
  sctx1.stroke();
}

const floodFill3 = (startX, startY, fillColor) => {
  const spreadColor = sctx1.getImageData(startX, startY, 1, 1).data;
  const w = scorecanvas1.width;
  const h = scorecanvas1.height;
  const imgData = sctx1.getImageData(0, 0, w, h);

  const pixelStack = [];

  let curX = startX;
  let curY = startY;

  if (compareColor(fillColor, imgData, startX, startY, w, h)) return;

  pixelStack.push([curX, curY]);

  while (pixelStack.length > 0) {
    let topAdd = true;
    let bottomAdd = true;
    [curX, curY] = pixelStack.pop();

    while (curX > 0 && compareColor(spreadColor, imgData, curX - 1, curY, w, h)) curX -= 1;

    while (curX < 200 && compareColor(spreadColor, imgData, curX, curY, w, h)) {
      setColor(fillColor, imgData, curX, curY, w);

      if (topAdd) {
        if (compareColor(spreadColor, imgData, curX, curY - 1, w, h)) {
          pixelStack.push([curX, curY - 1]);
          topAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY - 1, w, h)) topAdd = true;
      }

      if (bottomAdd) {
        if (compareColor(spreadColor, imgData, curX, curY + 1, w, h)) {
          pixelStack.push([curX, curY + 1]);
          bottomAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY + 1, w, h)) bottomAdd = true;
      }

      curX += 1;
    }
  }

  sctx1.putImageData(imgData, 0, 0);
}

const handleDrawingEvent4 = e => {
  switch (e.type) {
    case "draw":
      sctx2.strokeStyle = rgb2Hex(e.data.color[0], e.data.color[1], e.data.color[2]);
      sctx2.lineWidth = e.data.size;
      drawSegment4(e.data.fromX, e.data.fromY, e.data.toX, e.data.toY);
      break;
    case "fill":
      floodFill4(e.data.x, e.data.y, e.data.color);
      break;
    default:
      break;
  }
}


const drawSegment4 = (previousX, previousY, currentX, currentY) => {
  sctx2.beginPath(); // This empties the list of things to be drawn by stroke()
  sctx2.moveTo(previousX, previousY);
  sctx2.lineTo(currentX, currentY);
  sctx2.stroke();
}

const floodFill4 = (startX, startY, fillColor) => {
  const spreadColor = sctx2.getImageData(startX, startY, 1, 1).data;
  const w = scorecanvas2.width;
  const h = scorecanvas2.height;
  const imgData = sctx2.getImageData(0, 0, w, h);

  const pixelStack = [];

  let curX = startX;
  let curY = startY;

  if (compareColor(fillColor, imgData, startX, startY, w, h)) return;

  pixelStack.push([curX, curY]);

  while (pixelStack.length > 0) {
    let topAdd = true;
    let bottomAdd = true;
    [curX, curY] = pixelStack.pop();

    while (curX > 0 && compareColor(spreadColor, imgData, curX - 1, curY, w, h)) curX -= 1;

    while (curX < 200 && compareColor(spreadColor, imgData, curX, curY, w, h)) {
      setColor(fillColor, imgData, curX, curY, w);

      if (topAdd) {
        if (compareColor(spreadColor, imgData, curX, curY - 1, w, h)) {
          pixelStack.push([curX, curY - 1]);
          topAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY - 1, w, h)) topAdd = true;
      }

      if (bottomAdd) {
        if (compareColor(spreadColor, imgData, curX, curY + 1, w, h)) {
          pixelStack.push([curX, curY + 1]);
          bottomAdd = false;
        }
      } else {
        if (!compareColor(spreadColor, imgData, curX, curY + 1, w, h)) bottomAdd = true;
      }

      curX += 1;
    }
  }

  sctx2.putImageData(imgData, 0, 0);
}

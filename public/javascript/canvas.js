// TODO:
// Finish adding all needed canvas control buttons
// Make flood-fill work in mobile mode
// Make flood fill distinguish between transparent black and nontransparent black
//  - Or just make the default canvas not be transparent black
// Make cursor change on-hover
// Animated (on-hover, on-click) svg buttons?

/* ~~~~~~~~~~~~ General Setup ~~~~~~~~~~~~ */
const canvas1 = document.getElementById("canvas-1");
canvas1.width = 200;
canvas1.height = 400;

const ctx1 = canvas1.getContext("2d");
ctx1.lineCap = "round";

const offsetPosToCanvasPos = (x, y) => [
  x / canvas1.offsetWidth * canvas1.width,
  y / canvas1.offsetHeight * canvas1.height
]


/* ~~~~~~~~~~~~ Drawing Events ~~~~~~~~~~~~ */

const findLastIndex = (list, fxn) => {
  for (let i = list.length-1; i >=0; i--) {
    if (fxn(list[i])) return i;
  }

  return -1;
}

var drawingEvents = [];

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

const drawAndStore = (previousX, previousY, currentX, currentY, newPoint = false) => {
  drawingEvents.push({
    type: "draw",
    data: {
      fromX: previousX,
      fromY: previousY,
      toX: currentX,
      toY: currentY,
      color: currentRGB,
      size: currentSize
    }
  });
  drawSegment(previousX, previousY, currentX, currentY);
}

const fillAndStore = (x, y, fillColor) => {
  drawingEvents.push({
    type: "fill",
    data: {
      x,
      y,
      color: fillColor
    }
  });
  floodFill(x, y, fillColor);
}

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
  updateWidth();
}

const undoButton = document.getElementById("undo-button");
undoButton.onclick = e => {
  e.preventDefault();
  undoDrawingEvents();
}

const drawSegment = (previousX, previousY, currentX, currentY) => {
  ctx1.beginPath(); // This empties the list of things to be drawn by stroke()
  ctx1.moveTo(previousX, previousY);
  ctx1.lineTo(currentX, currentY);
  ctx1.stroke();
}

let [prevX, prevY] = [0, 0];

/* ~~~~~~~~~~~~ Clear Canvas ~~~~~~~~~~~~ */
const clearCanvas1 = () => {
  ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
  drawingEvents = []; //COULD make this be a clearCanvasEvent so it could be undone
}

const clearCanvasButton = document.getElementById("clear-canvas");
clearCanvasButton.onclick = e => {
  e.preventDefault();
  clearCanvas1();
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

/* ~~~~~~~~~~~~ Custom Canvas Cursor ~~~~~~~~~~~~ */
// Unfortunately, browsers do not give access to user zoom level:
// https://css-tricks.com/can-javascript-detect-the-browsers-zoom-level/
// The best I could do is use the original value of this and assume it means 100%.
const updateCursor = () => {
  const canvasWidth = canvas1.getBoundingClientRect().width;
  const radius = Math.round(currentSize/2 * canvasWidth/canvas1.width);

  const newStyle = `url(\"data:image/svg+xml;utf8, \
    <svg xmlns=\\"http://www.w3.org/2000/svg\\" version=\\"1.1\\" width=\\"${radius*2+2}\\" height=\\"${radius*2+2}\\">\
    <circle cx=\\"${radius}\\" cy=\\"${radius}\\" r=\\"${radius}\\" \
    style=\\"fill: rgb(${currentRGB[0]},${currentRGB[1]},${currentRGB[2]}); stroke: rgb(0,0,0);\\"/>\
    </svg>\") ${radius+1} ${radius+1}, auto`
  canvas1.style.cursor = newStyle;
}

/* ~~~~~~~~~~~~ Color Selection ~~~~~~~~~~~~ */
const colorSelect = document.querySelector('.color-range')
var currentRGB = [0, 0, 0];

const updateColor = () => {
  var hue = ((colorSelect.value / 100) * 360).toFixed(0);
  currentRGB = hsl2Rgb(hue, 100, 50);
  ctx1.strokeStyle = rgb2Hex(currentRGB[0], currentRGB[1], currentRGB[2]);

  updateCursor();
}

colorSelect.addEventListener('input', updateColor);

updateColor();

/* ~~~~~~~~~~~~ Brush Size ~~~~~~~~~~~~ */
const brushSize = document.getElementById("brush-size");
var currentSize = 5;

const updateWidth = () => {
  currentSize = brushSize.value;
  ctx1.lineWidth = currentSize;

  updateCursor();
}

brushSize.onchange = updateWidth;

updateWidth();

/* ~~~~~~~~~~~~ Tracking User Inputs ~~~~~~~~~~~~ */
/* ~~~~~~ Mouse Inputs ~~~~~~ */
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
  if (buttons === 1) {
    drawAndStore(prevX, prevY, canvasX, canvasY);
  }
}

canvas1.onmousemove = ({ offsetX, offsetY, buttons }) => {
  let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);

  if (buttons === 1) {
    drawAndStore(prevX, prevY, canvasX, canvasY);
  }
}

// If the user just taps the mouse, this draws a dot.
canvas1.onmousedown = ({ offsetX, offsetY, buttons }) => {
  let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);

  if (buttons === 1) {
    storeBreakpointEvent();
    drawAndStore(canvasX, canvasY, canvasX, canvasY, newPoint = true);
  } else if (buttons === 2) {
    storeBreakpointEvent();
    fillAndStore(...[canvasX, canvasY].map(Math.round), fillColor = [...currentRGB, 255]);
  }
}

canvas1.oncontextmenu = () => false;

/* ~~~~~~ Touchscreen Inputs ~~~~~~ */
const getOffsetFromTouchEvent = ev => {
  let { targetTouches: { 0: { pageX, pageY } } } = ev;
  return {
    offsetX: pageX - ev.target.getBoundingClientRect().left,
    offsetY: pageY - ev.target.getBoundingClientRect().top
  };
}

canvas1.ontouchstart = ev => {
  ev.preventDefault();

  let { offsetX, offsetY } = getOffsetFromTouchEvent(ev);
  let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);

  storeBreakpointEvent();
  drawAndStore(canvasX, canvasY, canvasX, canvasY);
  updatePreviousPositions(canvasX, canvasY);
}

canvas1.ontouchmove = ev => {
  ev.preventDefault();

  let { offsetX, offsetY } = getOffsetFromTouchEvent(ev);
  let [canvasX, canvasY] = offsetPosToCanvasPos(offsetX, offsetY);

  drawAndStore(prevX, prevY, canvasX, canvasY);
  updatePreviousPositions(canvasX, canvasY);
}



/* ~~~~~~ Flood Fill ~~~~~~ */
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
    closeTo(spreadColor[2], imgData.data[startPos + 2])
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
// Will we have problems with pixels starting out as transparent?
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



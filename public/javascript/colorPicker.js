function hsl2Rgb(h,s,l){
    s=s/100;
    l=l/100;
    var c,x,m,rgb;
    c=(1-Math.abs(2*l-1))*s;
    x=c*(1-Math.abs(((h/60)%2)-1));
    m=l-c/2;
    if(h>=0&&h<60) rgb=[c,x,0];
    if(h>=60&&h<120) rgb=[x,c,0];
    if(h>=120&&h<180) rgb=[0,c,x];
    if(h>=180&&h<240) rgb=[0,x,c];
    if(h>=240&&h<300) rgb=[x,0,c];
    if(h>=300&&h<=360) rgb=[c,0,x];

    return rgb.map(function(v){
        return 255*(v+m)|0;
    });
}

function rgb2Hex(r, g, b) {
    var rgb = b | (g << 8) | (r << 16);
    return '#' + (0x1000000 + rgb).toString(16).slice(1)
}

function hsl2Hex(h, s, l){
    var rgb = hsl2Rgb(h, s, l)
    return rgb2Hex( rgb[0], rgb[1], rgb[2] )
}

var colorRange = document.querySelector('.color-range')
var randomRange = Math.floor(100*Math.random())
var colorChoice = document.getElementById("color-choice")

colorRange.addEventListener('input', function(e) {
    var hue = ((this.value/100)*360).toFixed(0)
    var hsl = "hsl("+ hue + ", 100%, 50%)"
    var bgHsl = "hsl("+ hue + ", 100%, 95%)"
    var hex = hsl2Hex(hue,100,50)
    colorRange.style.color = hsl
    colorChoice.style.color = hsl
    colorChoice.innerHTML = hex
    document.body.style.background = bgHsl
});
colorRange.value = randomRange;
var event = new Event('input');
colorRange.dispatchEvent(event);

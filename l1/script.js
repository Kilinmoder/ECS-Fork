// Inspired By
// https://codepen.io/abeatrize/pen/LJqYey

// Bongo Cat originally created by @StrayRogue and @DitzyFlama

const ID = "bongo-cat";
const s = selector => `#${ID} ${selector}`;
const notes = document.querySelectorAll(".note");

for (let note of notes) {
  note.parentElement.appendChild(note.cloneNode(true));
  note.parentElement.appendChild(note.cloneNode(true));
}

const music = { note: s(".music .note") };
const terminal = { frame: s(".terminal-frame"), code: s(".terminal-code line") };
const cat = {
  pawRight: {
    up: s(".paw-right .up"),
    down: s(".paw-right .down") },

  pawLeft: {
    up: s(".paw-left .up"),
    down: s(".paw-left .down") } };



const style = getComputedStyle(document.documentElement);

const green = style.getPropertyValue("--green");
const pink = style.getPropertyValue("--pink");
const blue = style.getPropertyValue("--blue");
const orange = style.getPropertyValue("--orange");
const cyan = style.getPropertyValue("--cyan");

gsap.set(music.note, { scale: 0, autoAlpha: 1 });

const animatePawState = (selector) =>
gsap.fromTo(
selector,
{ autoAlpha: 0 },
{
  autoAlpha: 1,
  duration: 0.01,
  repeatDelay: 0.19,
  yoyo: true,
  repeat: -1 });



const tl = gsap.timeline();

tl.
add(animatePawState(cat.pawLeft.up), "start").
add(animatePawState(cat.pawRight.down), "start").
add(animatePawState(cat.pawLeft.down), "start+=0.19").
add(animatePawState(cat.pawRight.up), "start+=0.19").
timeScale(1.6);

gsap.from(".terminal-code line", {
  drawSVG: "0%",
  duration: 0.1,
  stagger: 0.1,
  ease: 'none',
  repeat: -1 });


const noteEls = gsap.utils.pipe(
gsap.utils.toArray,
gsap.utils.shuffle)(
music.note);

const numNotes = noteEls.length / 3;
const notesG1 = noteEls.splice(0, numNotes);
const notesG2 = noteEls.splice(0, numNotes);
const notesG3 = noteEls;

const colorizer = gsap.utils.random([green, pink, blue, orange, cyan, "#a3a4ec", "#67b5c0", "#fd7c6e"], true);
const rotator = gsap.utils.random(-50, 50, 1, true);
const dir = amt => `${gsap.utils.random(["-", "+"])}=${amt}`;

const animateNotes = els => {
  animating = true;
  els.forEach(el => {
    gsap.set(el, {
      stroke: colorizer(),
      rotation: rotator(),
      x: gsap.utils.random(-25, 25, 1) });

  });

  return gsap.fromTo(els, {
    autoAlpha: 1,
    y: 0,
    scale: 0 },
  {
    duration: 2,
    autoAlpha: 0,
    scale: 1,
    ease: "none",
    stagger: {
      from: "random",
      each: 0.5 },

    rotation: dir(gsap.utils.random(20, 30, 1)),
    x: dir(gsap.utils.random(40, 60, 1)),
    y: gsap.utils.random(-200, -220, 1),
    onComplete: () => {
      animating = false;
      if(showNotes)
        animateNotes(els)
      } });

};

//Yanky code for timing and what not to make music reactive
document.querySelectorAll('.music').forEach(x=>{
  x.style.transition = "opacity 0.5s ease-in-out 0s";
})
//The function that Wallpaper engines calls for audio viz
try{
  window.wallpaperPropertyListener ={
		applyUserProperties: function(properties) {
      if(properties.notes){
        force=properties.notes.value;
        showNotes = force;
        if(showNotes)musicOpacity(1);
        else musicOpacity(0);
        if(!animating)
          addNotes();
      }
    }}
  window.wallpaperRegisterAudioListener(wallpaperAudioListener);
}catch{};
let timing = false;
let showNotes = true;
let animating = false;
let timeout;
let force = true;
function wallpaperAudioListener(audioArr){
  if(force)
    return;
  //console.log(showNotes)
  if((audioArr[0]+audioArr[audioArr.length/2])/2>.05){
    if(timing){
      timing = false;
      clearTimeout(timeout);
    }
    if(!showNotes){
      showNotes = true; 
      musicOpacity(1);
      if(!animating)
        addNotes();
    }
  }
  else{
   if(!timing && showNotes){
      timing = true;
      timeout = setTimeout(()=>{
        timing = false;
        showNotes = false;
        musicOpacity(0);
      },750);
   }
  }
}

function musicOpacity(opacity){
  document.querySelectorAll('.music').forEach(x=>{
    x.style.opacity = opacity;
  })
}
function addNotes(){
  tl.
    add(animateNotes(notesG1)).
    add(animateNotes(notesG2), ">0.05").
    add(animateNotes(notesG3), ">0.25");
}
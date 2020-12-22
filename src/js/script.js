import Freqs from './Freqs.js';
import Keys from './Keys.js';

function initAudio() {
  try {
    ctx = new(window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    alert('web audio api not supported in this browser!');
  }
}

class Synth {

  constructor() {
    this.freqs = Freqs;
    this.keys = Keys;
    this.keyBtns = document.querySelectorAll('.keyboard li');
    this.controls = document.querySelector('.controls');

    this.threshold = 0.0069; // declick
    this.gain = 0.3; // avoid peaking for multiple notes... 1 is max gain, but will peak
    this.wave = document.querySelector('input[id=waveform-sine]').value;
    this.attack = document.querySelector('input[id=attack]').value;
    this.decay = document.querySelector('input[id=decay]').value;
    this.sustain = document.querySelector('input[id=sustain]').value;
    this.release = document.querySelector('input[id=release]').value;
    this.pitch = document.querySelector('input[id=pitch]').value;
    this.nodes = {}; // active nodes (notes that will be playing)

    this.keyboardControls();
    this.optionControls();
  }


  /**
   * play a note with the given key
   * 
   * @param {String} key 
   */
  playNote(key = 'a') {
    //console.log('playNote: ' + key); // debug

    const osc = ctx.createOscillator();
    const attack = ctx.createGain();
    const decay = ctx.createGain();
    const release = ctx.createGain();
    const freq = this.getFreq(key);

    // oscillator config
    osc.type = this.wave;
    osc.frequency.value = freq;
    osc.connect(attack);

    // attack config
    attack.gain.setValueAtTime(0.0001, ctx.currentTime);
    attack.gain.exponentialRampToValueAtTime(this.gain, ctx.currentTime + Math.max(this.threshold, this.attack));
    attack.connect(decay);

    // decay config
    decay.gain.setValueAtTime(this.gain, ctx.currentTime + Math.max(this.threshold, this.attack));
    decay.gain.exponentialRampToValueAtTime(this.sustain / 100, ctx.currentTime + Math.max(this.threshold, this.attack + this.decay));
    decay.connect(release);
    release.connect(ctx.destination); // release settings determined after we let go of key

    osc.start(0);

    Array.from(this.keyBtns)
      .filter((btn) => btn.dataset.note === key)[0]
      .classList.add('active');

    this.nodes[key] = {
      osc: osc,
      release: release,
    }
    //console.log('active nodes: ' + Object.keys(this.nodes)); // debug
  }

  /**
   * end the given node and clean up
   * 
   * @param {Object} node 
   */
  endNote(node) {
    //console.log('endnote: ' + node); // debug

    const release = node.release;

    // release config
    release.gain.setValueAtTime(this.sustain / 100, ctx.currentTime);
    release.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + Math.max(this.threshold, this.release));

    setTimeout(() => {
      node.osc.stop(0);
    }, 1000 * (ctx.currentTime + Math.max(this.threshold, this.release)));

    Object.keys(this.nodes).forEach((key) => {
      if (this.nodes[key] === node) {
        Array.from(this.keyBtns)
          .filter((btn) => btn.dataset.note === key)[0]
          .classList.remove('active');
        delete this.nodes[key];
      }
    });
  }


  /**
   * listeners for computer user controls
   */
  keyboardControls() {
    // holding the key on computer keyboard
    document.addEventListener('keydown', (e) => {
      if (!this.keys[e.code] || // key does not have note
        this.nodes[this.keys[e.code]] // note already playing
      ) return;

      this.playNote(this.keys[e.code]);
    }, {
      passive: true
    });

    // letting go of the key on computer keyboard
    document.addEventListener('keyup', (e) => {
      if (!this.keys[e.code] || // key does not have note
        !this.nodes[this.keys[e.code]] // note not playing
      ) return;

      this.endNote(this.nodes[this.keys[e.code]]);
    }, {
      passive: true
    });

    // ADD MOUSE/TOUCH CLICKS/UP FOR EACH PIANO KEY ON SCREEN
    this.keyBtns.forEach((btn) => {
      // mouse click
      btn.addEventListener(
        'mousedown',
        (e) => {
          const key = btn.dataset.note;
          if (!key || !this.freqs[key] || this.nodes[key]) return;

          this.playNote(key);
        }, {
          passive: true
        }
      );

      // change button while clicked (glissando)
      btn.addEventListener(
        'mouseenter',
        (e) => {
          const key = btn.dataset.note;
          if (!e.buttons || !key || !this.freqs[key] || this.nodes[key]) return;

          this.playNote(key);
        }, {
          passive: true
        }
      );

      // release mouse
      btn.addEventListener(
        'mouseup',
        (e) => {
          const key = btn.dataset.note;
          if (!key || !this.freqs[key] || !this.nodes[key]) return;

          this.endNote(this.nodes[key]);
        }, {
          passive: true
        }
      )
      btn.addEventListener(
        'mouseleave',
        (e) => {
          const key = btn.dataset.note;
          if (!key || !this.freqs[key] || !this.nodes[key]) return;

          this.endNote(this.nodes[key]);
        }, {
          passive: true
        }
      )

      // for touch screens
      btn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          const key = btn.dataset.note;
          if (!key || !this.freqs[key] || this.nodes[key]) return;

          this.playNote(key);
        }
      );
      btn.addEventListener(
        'touchmove',
        (e) => {
          e.preventDefault();
          const key = btn.dataset.note;
          if (!key || !this.freqs[key] || this.nodes[key]) return;

          this.playNote(key);
        }
      );
      btn.addEventListener(
        'touchend',
        (e) => {
          e.preventDefault();
          const key = btn.dataset.note;
          if (!key || !this.freqs[key] || !this.nodes[key]) return;

          this.endNote(this.nodes[key]);
        }
      );
      btn.addEventListener(
        'touchcancel',
        (e) => {
          const key = btn.dataset.note;
          if (!key || !this.freqs[key] || !this.nodes[key]) return;

          this.endNote(this.nodes[key]);
        }, {
          passive: true
        }
      );
    })
  }

  /**
   * configure user option controls
   */
  optionControls() {
    // ADD THE ROUND SLIDERS
    const initRoundSliders = () => {
      var inputs = document.getElementsByTagName("input");

      // create a round slider for each "range" type item in the html
      for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].type.toLowerCase() == 'range') {
          $(inputs[i]).roundSlider({
            sliderType: "min-range",
            handleShape: "round",
            circleShape: "full",
            startAngle: -45,
            endAngle: +225,
            enableTooltip: false,
            width: 13,
            radius: 30,
            value: inputs[i].value,
            min: inputs[i].min,
            max: inputs[i].max,
            step: inputs[i].step,
            mouseScrollAction: true,
            change: (e) => {
              //console.log(`changed ${inputs[i].dataset.control}: ${inputs[i].value}`); // debug
              applyOptions();
            }
          });
        }
      }
    }

    // CHANGE THE OPTIONS
    const applyOptions = () => {
      let data = Object.fromEntries(new FormData(this.controls));
      //console.log(data); // debug

      this.wave = data.waveform;
      this.pitch = parseFloat(data.pitch);
      this.attack = parseFloat(data.attack) + 0.0001;
      this.decay = parseFloat(data.decay) + 0.0001;
      this.sustain = parseFloat(data.sustain) + 0.0001;
      this.release = parseFloat(data.release) + 0.0001;

      // store in browser storage
      localStorage.synthConfig = JSON.stringify({
        wave: this.wave,
        pitch: this.pitch,
        attack: this.attack,
        decay: this.decay,
        release: this.release,
      });
    }

    initRoundSliders();
    this.controls.addEventListener('change', applyOptions);

    // dont reset page on Enter, simply lose focus
    this.controls.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });
  }


  /**
   * get the frequency value given the key string
   * 
   * @param {String} key string value of the key
   * @returns the frequency value of the given string
   */
  getFreq(key) {
    let freq = this.freqs[key] || 440; // if non-existent, default to A4 = 440Hz

    // go up the necessary number of octaves
    for (let i = 1; i <= this.pitch - 1; ++i) freq *= 2;

    return freq;
  }
}

// load Audio Context
var ctx;
window.addEventListener('load', initAudio, false);

new Synth();
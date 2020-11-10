import React, {Component} from "react";

import * as THREE from 'three-full';
import vxShader from './main.vert';
import fragShader from './main.frag';
import * as dat from 'dat.gui'
import parse from 'color-parse';
import {BufferGeometry, Float32BufferAttribute, Geometry, TorusGeometry, Vector3} from "three-full";

function optionColorToVec3(color){
  let parsedColor = parse(color);

  let values = parsedColor.values;

  return new THREE.Vector3(values[0] / 255, values[1] / 255, values[2] / 255);
}

class MyTorusGeometry extends Geometry {

  constructor( radius, tube, radialSegments, tubularSegments, image_data, width, height, arc ) {

    super();
    this.type = 'MyTorusGeometry';

    this.parameters = {
      radius: radius,
      tube: tube,
      radialSegments: radialSegments,
      tubularSegments: tubularSegments,
      image_data: image_data,
      width: width,
      height: height,
      arc: arc
    };

    this.fromBufferGeometry( new MyTorusBufferGeometry( radius, tube, radialSegments, tubularSegments, image_data, width, height, arc ) );
    this.mergeVertices();

  }

}


class MyTorusBufferGeometry extends BufferGeometry {

  constructor( radius, tube, radialSegments, tubularSegments, image_data, width, height, arc ) {

    super();
    this.type = 'TorusBufferGeometry';

    this.parameters = {
      radius: radius,
      tube: tube,
      radialSegments: radialSegments,
      tubularSegments: tubularSegments,
      image_data: image_data,
      width: width,
      height: height,
      arc: arc
    };

    radius = radius || 1;
    tube = tube || 0.4;
    radialSegments = Math.floor( radialSegments ) || 8;
    tubularSegments = Math.floor( tubularSegments ) || 6;
    arc = arc || Math.PI * 2;

    // buffers

    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];

    // helper variables

    const center = new Vector3();
    const vertex = new Vector3();
    const normal = new Vector3();

    // generate vertices, normals and uvs

    for ( let j = 0; j <= radialSegments; j ++ ) {

      for ( let i = 0; i <= tubularSegments; i ++ ) {
/*
        console.log(Math.floor(j * image_data.width / radialSegments) % image_data.width);
        console.log(Math.floor(j * image_data.width / radialSegments));
        console.log(j * image_data.width / radialSegments);
        console.log(j * image_data.width);
        console.log(image_data.width);
        console.log(j);*/

        const x = Math.floor(j * width / radialSegments) % width;
        const y = Math.floor(i * height / tubularSegments) % height;
        // compute row offsets into the height data
        // we multiply by 4 because the data is R,G,B,A but we
        // only care about R
        const base0 = (y * width + x) * 4;

        const current_tube = tube + image_data[base0] / 128;
/*
        console.log(image_data);
        console.log(x);
        console.log(y);
        console.log(base0);
        console.log(image_data[base0] / 32);
*/
        const u = i / tubularSegments * arc;
        const v = j / radialSegments * Math.PI * 2;

        // vertex

        vertex.x = ( radius + current_tube * Math.cos( v ) ) * Math.cos( u );
        vertex.y = ( radius + current_tube * Math.cos( v ) ) * Math.sin( u );
        vertex.z = current_tube * Math.sin( v );

        vertices.push( vertex.x, vertex.y, vertex.z );

        // normal

        center.x = radius * Math.cos( u );
        center.y = radius * Math.sin( u );
        normal.subVectors( vertex, center ).normalize();

        normals.push( normal.x, normal.y, normal.z );

        // uv

        uvs.push( i / tubularSegments );
        uvs.push( j / radialSegments );

      }

    }

    // generate indices

    for ( let j = 1; j <= radialSegments; j ++ ) {

      for ( let i = 1; i <= tubularSegments; i ++ ) {

        // indices

        const a = ( tubularSegments + 1 ) * j + i - 1;
        const b = ( tubularSegments + 1 ) * ( j - 1 ) + i - 1;
        const c = ( tubularSegments + 1 ) * ( j - 1 ) + i;
        const d = ( tubularSegments + 1 ) * j + i;

        // faces

        indices.push( a, b, d );
        indices.push( b, c, d );

      }

    }

    // build geometry

    this.setIndex( indices );
    this.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
    this.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
    this.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );

  }

}

function createHeightmap(image, material, scene) {
  // extract the data from the image by drawing it to a canvas
  // and calling getImageData
  const ctx = document.createElement('canvas').getContext('2d');
  const {width, height} = image;
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  ctx.drawImage(image, 0, 0);
  const {data} = ctx.getImageData(0, 0, width, height);

  const radius = 10;
  const tube = 3;
  const radialSegments = 64;
  const tubularSegments = 100;

  const geometry = new MyTorusGeometry( radius, tube, radialSegments, tubularSegments, data, width, height);

  scene.add(new THREE.Mesh(geometry, material))
}

function addLight(scene, ...pos) {
  const color = 0xFFFFFF;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(...pos);
  scene.add(light);
}

export class ViewArea extends Component {
  constructor(props) {
    super(props);

    this.customMaterial = new THREE.ShaderMaterial({
      uniforms:
      {
        u_color: {value: new THREE.Vector3()},
      },

      vertexShader: vxShader,
      fragmentShader: fragShader
    });

    this.canvasRef = React.createRef();
    this.divRef = React.createRef();

    this.scene = new THREE.Scene();
    const fov = 75;
    const aspect = 2;  // the canvas default
    const near = 0.1;
    const far = 200;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(20, 20, 20);

    const imgLoader = new THREE.ImageLoader();
    imgLoader.load('https://threejsfundamentals.org/threejs/resources/images/heightmap-96x64.png', image => createHeightmap(image, this.customMaterial, this.scene));

    addLight(this.scene, -1, 2, 4);
    addLight(this.scene,1, 2, -2);

    this.options = {
      color: "#ffae23",
      rotationSpeed: 60
    };
  }

  componentDidMount() {
    const canvas = this.canvasRef.current;
    if (!canvas) {
      return;
    }

    this.controls = new THREE.OrbitControls(this.camera, this.canvasRef.current);
    this.controls.update();

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      return;
    }

    this.addDatGUI();

    const renderer = new THREE.WebGLRenderer({canvas: canvas, context: gl});
    renderer.setSize(canvas.width, canvas.height );

    this.prevTime = new Date();

    const renderLoopTick = () => {
      // Handle resize
      if (this.divRef.current.offsetWidth !== canvas.width ||
          this.divRef.current.offsetHeight !== canvas.height) {
            console.log(`Resizing canvas: ${this.divRef.current.offsetWidth}x${this.divRef.current.offsetHeight}`);

            canvas.width = this.divRef.current.offsetWidth;
            canvas.height = this.divRef.current.offsetHeight;

            renderer.setSize(canvas.width, canvas.height );

            const d = new THREE.Vector3();
            const q = new THREE.Quaternion();
            const s = new THREE.Vector3();
            this.camera.matrixWorld.decompose(d, q, s);
            this.camera.position.copy(d);
            this.camera.quaternion.copy(q);
            this.camera.scale.copy(s);

            this.camera = new THREE.PerspectiveCamera(90, canvas.width / canvas.height, this.camera.near, this.camera.far);

            this.camera.position.set(d.x, d.y, d.z);
            this.camera.quaternion.clone(q);
            this.camera.scale.set(s.x, s.y, s.z);
            this.controls = new THREE.OrbitControls(this.camera, canvas);
      }

      const curTime = new Date();

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.2, 0.2, 0.2, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      this.controls.update();

      this.customMaterial.uniforms.u_color.value = optionColorToVec3(this.options.color);

      renderer.render( this.scene, this.camera );

      this.prevTime = curTime;

      requestAnimationFrame(renderLoopTick);
    }

    requestAnimationFrame(renderLoopTick);

  }

  addDatGUI = () => {
    this.gui = new dat.GUI({ name: "My GUI" });

    var fields = this.gui.addFolder("Field");
    fields.addColor(this.options, "color");
    fields.add(this.options, "rotationSpeed", 0, 360, 1);
    fields.open();
  }

  render() {
    return (
      <div ref={this.divRef} style={{width: "100%",height: "100vh"}}>
        <canvas
          ref={this.canvasRef}
          style={{width: "100%",height: "100%"}}
        />
      </div>
  );
  }
}

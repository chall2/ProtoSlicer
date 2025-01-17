import {BufferGeometry, Mesh, Object3D, Scene, Vector3} from "three";
import * as THREE from "three";
import {sceneStore} from "../Scene/SceneStore";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader";
import {LineMaterial} from "three/examples/jsm/lines/LineMaterial";
import {LineGeometry} from "three/examples/jsm/lines/LineGeometry";
import {Line2} from "three/examples/jsm/lines/Line2";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {matLine} from "../../Globals";

export namespace SceneHelper {
    export type Grid = {
        obj: any;
        mat: LineMaterial;
        dispose: Function;
    }

    export function CreateGrid(size: THREE.Vector3, scene: THREE.Scene): Grid {
        var positions: any[] = [];

        let gridSizeX = size.x;
        let gridSizeY = size.z;
        let gridSizeZ = size.y;

        positions.push(0, 0, 0);

        for (let x = 1; x <= gridSizeX; x++) {
            for (let y = 1; y <= gridSizeY; y++) {
                positions.push(x, 0, 0);
                positions.push(x, 0, y);
                positions.push(0, 0, y);
                positions.push(0, 0, 0);
            }
        }

        /*positions.push(0, gridSizeZ, 0);
        positions.push(gridSizeX, gridSizeZ, 0);
        positions.push(gridSizeX, 0, 0);
        positions.push(gridSizeX, gridSizeZ, 0);
        positions.push(gridSizeX, gridSizeZ, gridSizeY);
        positions.push(gridSizeX, 0, gridSizeY);
        positions.push(gridSizeX, gridSizeZ, gridSizeY);
        positions.push(0, gridSizeZ, gridSizeY);
        positions.push(0, 0, gridSizeY);
        positions.push(0, gridSizeZ, gridSizeY);
        positions.push(0, gridSizeZ, 0);*/

        // Line2 ( LineGeometry, LineMaterial )

        var geometry = new LineGeometry();
        geometry.setPositions(positions);

        var line = new Line2(geometry, matLine);

        scene.add(line);

        return {
            obj: line,
            mat: matLine,
            dispose: ()=> {
                geometry.dispose();
                scene.remove(line);
            }
        } as Grid;
    }
    export function CreateAxesHelper(scene: THREE.Scene):THREE.Object3D {
        const origin = new THREE.Vector3();
        const size = 1;

        const axesHelper = new THREE.Object3D();
        axesHelper.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0.01, 0.01), origin, size, "#b80808"));
        axesHelper.add(new THREE.ArrowHelper(new THREE.Vector3(0.01, 1, 0.01), origin, size, "#09b111"));
        axesHelper.add(new THREE.ArrowHelper(new THREE.Vector3(0.01, 0.01, 1), origin, size, "#091ab1"));

        scene.add(axesHelper);

        return axesHelper;
    }
    export function FitCameraToObject( camera: THREE.PerspectiveCamera, object: THREE.Object3D, offset: number, controls: OrbitControls ) {
        const boundingBox = new THREE.Box3();
        boundingBox.setFromObject( object );

        var middle = new THREE.Vector3();
        var size = new THREE.Vector3();
        boundingBox.getSize(size);

        // figure out how to fit the box in the view:
        // 1. figure out horizontal FOV (on non-1.0 aspects)
        // 2. figure out distance from the object in X and Y planes
        // 3. select the max distance (to fit both sides in)
        //
        // The reason is as follows:
        //
        // Imagine a bounding box (BB) is centered at (0,0,0).
        // Camera has vertical FOV (camera.fov) and horizontal FOV
        // (camera.fov scaled by aspect, see fovh below)
        //
        // Therefore if you want to put the entire object into the field of view,
        // you have to compute the distance as: z/2 (half of Z size of the BB
        // protruding towards us) plus for both X and Y size of BB you have to
        // figure out the distance created by the appropriate FOV.
        //
        // The FOV is always a triangle:
        //
        //  (size/2)
        // +--------+
        // |       /
        // |      /
        // |     /
        // | F° /
        // |   /
        // |  /
        // | /
        // |/
        //
        // F° is half of respective FOV, so to compute the distance (the length
        // of the straight line) one has to: `size/2 / Math.tan(F)`.
        //
        // FTR, from https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
        // the camera.fov is the vertical FOV.

        const fov = camera.fov * ( Math.PI / 180 );
        const fovh = 2*Math.atan(Math.tan(fov/2) * camera.aspect);
        let dx = size.z / 2 + Math.abs( size.x / 2 / Math.tan( fovh / 2 ) );
        let dy = size.z / 2 + Math.abs( size.y / 2 / Math.tan( fov / 2 ) );
        let cameraZ = Math.max(dx, dy);

        // offset the camera, if desired (to avoid filling the whole canvas)
        if( offset !== undefined && offset !== 0 ) cameraZ *= offset;

        camera.position.set( 0, 0, cameraZ );

        // set the far plane of the camera so that it easily encompasses the whole object
        const minZ = boundingBox.min.z;
        const cameraToFarEdge = ( minZ < 0 ) ? -minZ + cameraZ : cameraZ - minZ;

        camera.far = cameraToFarEdge * 3;
        camera.updateProjectionMatrix();

        if ( controls !== undefined ) {
            // set camera to rotate around the center
            controls.target = new THREE.Vector3(0, 0, 0);

            // prevent camera from zooming out far enough to create far plane cutoff
            controls.maxDistance = cameraToFarEdge * 2;
        }
    }
    export function ToScreenPosition(obj, camera, renderer) {
        var vector = new THREE.Vector3();

        var widthHalf = 0.5*renderer.context.canvas.width;
        var heightHalf = 0.5*renderer.context.canvas.height;

        obj.updateMatrixWorld();
        vector.setFromMatrixPosition(obj.matrixWorld);
        vector.project(camera);

        vector.x = ( vector.x * widthHalf ) + widthHalf;
        vector.y = - ( vector.y * heightHalf ) + heightHalf;

        return {
            x: vector.x,
            y: vector.y
        };

    }
    export function File3DLoad(file: File | string, handler: Function): boolean {
        let extension: string = (()=>{
            let array;

            if(typeof file === 'string')
            {
                array = file;
            }
            else
            {
                array = file.name;
            }

            array = array.split('.');

            return (array[array.length - 1] as string).toLocaleLowerCase();
        })();

        var loader;

        //Log(extension)

        switch (extension) {
            case "stl":
                loader = new STLLoader();
                loader.load((typeof file === 'string' ? file : file.path), function ( geometry ) {
                    handler(geometry);
                });
                return true;
            default:
                return false;
        }
    } 
}


export const LinearGenerator = (()=>{
    let linearGenerator: number = 0;

    return function () {
        linearGenerator++;

        return linearGenerator;
    }
})();
export function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!
    return !isNaN(+str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}
export function isFloat(n) {
    return n === +n && n !== (n|0);
}

export function isInteger(n) {
    return n === +n && n === (n|0);
}
export function SimpleCopyObj(from: any, to:any) {
    for(let val1 in from)
    {
        to[val1] = from[val1];
    }
}
export function DrawDirLine(origin, dir: Vector3, scene: Scene = sceneStore.scene, length : number = 100)
{
    dir.normalize();

    const hex = 0xf27f00;

    const arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );

    scene.add( arrowHelper );
}
export function DrawPoint(origin,  scene, size : number = 0.05)
{
    const geometry = new THREE.SphereGeometry( size, 32, 16 );
    const material = new THREE.MeshBasicMaterial( { color: 0xf27f00 } );
    const sphere = new THREE.Mesh( geometry, material );

    sphere.position.set(origin.x,origin.y,origin.z);

    scene.add( sphere );
}
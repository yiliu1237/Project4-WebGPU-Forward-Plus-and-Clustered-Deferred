import { Mat4, mat4, Vec3, vec3 } from "wgpu-matrix";
import { toRadians } from "../math_util";
import { device, canvas, fovYDegrees, aspectRatio } from "../renderer";

class CameraUniforms {
    readonly buffer = new ArrayBuffer(
        16 * 4 +   // viewProjMat
        16 * 4 +   // invProjMat
        16 * 4 +    // invViewMat
        4 * 4   // cameraParams
    );

    set viewProjMat(mat: Float32Array) {
        new Float32Array(this.buffer).set(mat, 0);
    }

    set invViewProjMat(matrix: Float32Array) {
        new Float32Array(this.buffer).set(matrix, 16);
    }

    set invViewMat(matrix: Float32Array) {
        new Float32Array(this.buffer).set(matrix, 32);
    }

    set cameraParams(value: Float32Array) {
        new Float32Array(this.buffer).set(value, 48);
    }

}




export class Camera {
    uniforms: CameraUniforms = new CameraUniforms();
    uniformsBuffer: GPUBuffer;

    projMat: Mat4 = mat4.create();
    cameraPos: Vec3 = vec3.create(-7, 2, 0);
    cameraFront: Vec3 = vec3.create(0, 0, -1);
    cameraUp: Vec3 = vec3.create(0, 1, 0);
    cameraRight: Vec3 = vec3.create(1, 0, 0);
    yaw: number = 0;
    pitch: number = 0;
    moveSpeed: number = 0.004;
    sensitivity: number = 0.15;

    static readonly nearPlane = 0.1;
    static readonly farPlane = 1000;

    keys: { [key: string]: boolean } = {};

    constructor() {

        // allocate the camera's uniform buffer
        this.uniformsBuffer = device.createBuffer({
            label: "camera",
            size: this.uniforms.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.projMat = mat4.perspective(toRadians(fovYDegrees), aspectRatio, Camera.nearPlane, Camera.farPlane);

        this.rotateCamera(0, 0); // set initial camera vectors

        window.addEventListener('keydown', (event) => this.onKeyEvent(event, true));
        window.addEventListener('keyup', (event) => this.onKeyEvent(event, false));
        window.onblur = () => this.keys = {}; // reset keys on page exit so they don't get stuck (e.g. on alt + tab)

        canvas.addEventListener('mousedown', () => canvas.requestPointerLock());
        canvas.addEventListener('mouseup', () => document.exitPointerLock());
        canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
    }

    private onKeyEvent(event: KeyboardEvent, down: boolean) {
        this.keys[event.key.toLowerCase()] = down;
        if (this.keys['alt']) { // prevent issues from alt shortcuts
            event.preventDefault();
        }
    }

    private rotateCamera(dx: number, dy: number) {
        this.yaw += dx;
        this.pitch -= dy;

        if (this.pitch > 89) {
            this.pitch = 89;
        }
        if (this.pitch < -89) {
            this.pitch = -89;
        }

        const front = mat4.create();
        front[0] = Math.cos(toRadians(this.yaw)) * Math.cos(toRadians(this.pitch));
        front[1] = Math.sin(toRadians(this.pitch));
        front[2] = Math.sin(toRadians(this.yaw)) * Math.cos(toRadians(this.pitch));

        this.cameraFront = vec3.normalize(front);
        this.cameraRight = vec3.normalize(vec3.cross(this.cameraFront, [0, 1, 0]));
        this.cameraUp = vec3.normalize(vec3.cross(this.cameraRight, this.cameraFront));
    }

    private onMouseMove(event: MouseEvent) {
        if (document.pointerLockElement === canvas) {
            this.rotateCamera(event.movementX * this.sensitivity, event.movementY * this.sensitivity);
        }
    }

    private processInput(deltaTime: number) {
        let moveDir = vec3.create();

        if (this.keys['w']) moveDir = vec3.add(moveDir, this.cameraFront);
        if (this.keys['s']) moveDir = vec3.sub(moveDir, this.cameraFront);
        if (this.keys['a']) moveDir = vec3.sub(moveDir, this.cameraRight);
        if (this.keys['d']) moveDir = vec3.add(moveDir, this.cameraRight);
        if (this.keys['q']) moveDir = vec3.sub(moveDir, this.cameraUp);
        if (this.keys['e']) moveDir = vec3.add(moveDir, this.cameraUp);

        let speed = this.moveSpeed * deltaTime;
        if (this.keys['shift']) speed *= 3;
        if (this.keys['alt']) speed /= 3;

        if (vec3.length(moveDir) > 0) {
            this.cameraPos = vec3.add(this.cameraPos, vec3.scale(vec3.normalize(moveDir), speed));
        }
    }

    onFrame(deltaTime: number) {
        this.processInput(deltaTime);

        const lookPos = vec3.add(this.cameraPos, vec3.scale(this.cameraFront, 1));
        const viewMat = mat4.lookAt(this.cameraPos, lookPos, [0, 1, 0]);
        const viewProjMat = mat4.mul(this.projMat, viewMat);

        this.uniforms.viewProjMat = viewProjMat;
        this.uniforms.cameraParams = [Camera.nearPlane, Camera.farPlane, 0.0, 0.0];

        this.uniforms.invViewProjMat = mat4.invert(this.projMat);
        this.uniforms.invViewMat = mat4.invert(viewMat);

        device.queue.writeBuffer(this.uniformsBuffer, 0, this.uniforms.buffer);
    }
}

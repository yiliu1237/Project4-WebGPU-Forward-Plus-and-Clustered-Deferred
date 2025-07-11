// CHECKITOUT: code that you add here will be prepended to all shaders

struct Light {
    pos: vec3f,
    color: vec3f
}

struct LightSet {
    numLights: u32,
    lights: array<Light>
}


struct ClusterLightIndexBuffer {
    indices: array<u32>
};


struct CameraUniforms {
    
    //view-projection matrix
    viewProjMat:  mat4x4<f32>, // offset 0

    //inverse view-projection matrix
    invViewProjMat:  mat4x4<f32>, // offset 64

    //inverse view matrix
    invViewMat:  mat4x4<f32>, // offset 128
        
    //camera properties
    cameraParams: vec4<f32> // offset 192
}

// CHECKITOUT: this special attenuation function ensures lights don't affect geometry outside the maximum light radius
fn rangeAttenuation(distance: f32) -> f32 {
    return clamp(1.f - pow(distance / ${lightRadius}, 4.f), 0.f, 1.f) / (distance * distance);
}

fn calculateLightContrib(light: Light, posWorld: vec3f, nor: vec3f) -> vec3f {
    let vecToLight = light.pos - posWorld;
    let distToLight = length(vecToLight);

    let lambert = max(dot(nor, normalize(vecToLight)), 0.f);
    return light.color * lambert * rangeAttenuation(distToLight);
}

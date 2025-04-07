// Instance attributes
attribute vec3 instancePosition;
attribute float instanceHeight;
attribute vec3 instanceColor;

// A-Frame specific uniforms
uniform vec3 ambientLightColor;
uniform vec3 directionalLightColor[5];
uniform vec3 directionalLightDirection[5];

varying vec3 vColor;
varying float vHeight;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vColor = instanceColor;
    vHeight = instanceHeight;
    
    // Apply instance position and scale height
    vec3 transformed = position;
    transformed.y *= instanceHeight;
    
    // Properly transform normals when scaling is applied
    vec3 transformedNormal = normal;
    // Adjust normal to account for y-scaling
    if (abs(normal.y) > 0.0) {
        transformedNormal = normalize(vec3(normal.x, normal.y / instanceHeight, normal.z));
    }
    vNormal = normalMatrix * transformedNormal;
    
    // Apply instance position
    vec4 worldPosition = modelMatrix * vec4(transformed + instancePosition, 1.0);
    
    // Calculate view-space position for lighting
    vec4 viewPosition = viewMatrix * worldPosition;
    vViewPosition = viewPosition.xyz;
    
    // Standard vertex transformation
    gl_Position = projectionMatrix * viewPosition;
}
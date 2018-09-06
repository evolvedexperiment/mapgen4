/*
 * From https://www.redblobgames.com/maps/mapgen4/
 * Copyright 2018 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 *
 * This module runs the worker thread that calculates the map data.
 */
'use strict';

const DualMesh = require('@redblobgames/dual-mesh');
const Map      = require('./map');
const Geometry = require('./geometry');

console.log('Worker loaded');

function Worker(self) {
    // This handler is for the initial message
    let handler = event => {
        console.log("Worker initializing");
        const param = event.data.param;

        // NOTE: web worker messages only include the data; to
        // reconstruct the full object I call the constructor again
        // and then copy the data over
        const mesh = new DualMesh(event.data.mesh);
        Object.assign(mesh, event.data.mesh);
        
        const map = new Map(mesh, param);

        // This handler is for all subsequent messages
        handler = event => {
            console.log("Worker update started");
            let {constraints, quad_elements_buffer, a_quad_em_buffer, a_river_uv_buffer} = event.data;
            constraints.at = function(x, y) {
                const size = this.size;
                // TODO: copied from Painting.js :-(
                y = (size * y) | 0;
                x = (size * x) | 0;
                if (0 <= x && x < size && 0 <= y && y < size) {
                    let p = size * y + x;
                    return this.constraints[p];
                } else {
                    return this.OCEAN;
                }
            };
            
            let start_time = performance.now();
            map.assignElevation(constraints);
            map.assignRivers();
            Geometry.setMapGeometry(map, new Int32Array(quad_elements_buffer), new Float32Array(a_quad_em_buffer));
            Geometry.setRiverTextures(map, param.spacing, new Float32Array(a_river_uv_buffer));
            let elapsed = performance.now() - start_time;

            self.postMessage(
                {elapsed,
                 quad_elements_buffer,
                 a_quad_em_buffer,
                 a_river_uv_buffer,
                },
                [
                    quad_elements_buffer,
                    a_quad_em_buffer,
                    a_river_uv_buffer,
                ]
            );
        };
    };
        
    self.addEventListener('message', event => handler(event));
}

module.exports = Worker;

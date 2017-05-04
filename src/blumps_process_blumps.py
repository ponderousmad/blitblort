#!/usr/bin/env python
#

import os
import json
from gimpfu import *

def pair_crop(image, crop_width, crop_top, crop_bottom):
    height = image.height / 2
    center = image.width / 2
    crop_left = center - crop_width / 2
    crop_height = crop_bottom - crop_top
    layer_copy = pdb.gimp_layer_copy(image.layers[0], FALSE)
    pdb.gimp_image_insert_layer(image, layer_copy, None, 1)
    pdb.gimp_layer_translate(image.layers[1], 0, -height)
    pdb.gimp_crop(image, crop_width, crop_height, crop_left, crop_top)
    pdb.gimp_layer_resize_to_image_size(image.layers[0])
    pdb.gimp_layer_resize_to_image_size(image.layers[1])
    pdb.gimp_image_resize(image, crop_width, 2 * crop_height, 0, 0)
    pdb.gimp_layer_translate(image.layers[1], 0, crop_height)
    pdb.gimp_image_merge_visible_layers(image, 1)

def process_blumps(img, drw, folder, batchRoot, width, top, bottom, pixelSize, depthRange):
    ''' Process the Blump files in the specified folder folder.
    
    Parameters:
    folder : string The folder to search for images.
    batchRoot : folder used to set up the batch.
    width: width of capture region.
    top: top of capture region.
    bottom: bottom of capture region.
    pixelSize: pixel size in meters.
    depthRange: depth range in meters.
    '''
    # Iterate the folder
    for path, dirnames, filenames in os.walk(folder):
        try:
            print path
            images = []
            for file in filenames:
                if(file.endswith(('.PNG'))):
                    filepath = os.path.join(path, file)
                    image = pdb.file_png_load(filepath, filepath)
                    # Verify if the file is an image.
                    if(image != None):
                        name_parts = file.split(' ')
                        base_name = name_parts[0]
                        image_number = name_parts[2].split(".")[0]
                        out_name = base_name + image_number + ".png"
                        outpath = os.path.join(path, base_name + image_number + ".png")
                        pair_crop(image, width, top, bottom)
                        images.append((int(image_number), out_name))
                        pdb.file_png_save(image, image.layers[0], outpath, outpath, 0, 9, 0, 0, 0, 0, 0)
                        os.remove(filepath)

            if len(images) > 0:
                relative_path = os.path.relpath(path, batchRoot).replace("\\", "/")
                if not relative_path.endswith("/"):
                    relative_path += "/"
                data = {
                    "pixelSize": pixelSize,
                    "depthRange": depthRange
                }
                blumps = []
                angle = 0
                angle_step = 360 / len(images)
                
                for entry in sorted(images, key=lambda entry: entry[0]):
                    blumps.append({
                        "resource": relative_path + entry[1],
                        "angle": angle
                    })
                    angle += angle_step
                data["blumps"] = blumps

                with open(os.path.join(path, "frame.JSON"), 'w') as f:
                    f.write(json.dumps(data, indent=4))
        
        except Exception as err:
            gimp.message("Unexpected error: " + str(err))

register(
    "blumps_process_blumps",
    "Process Blumps",
    "Process the Blumps in a folder",
    "ponderousmad",
    "Open source (MIT license)",
    "2017",
    "<Image>/Filters/Blumps/Process blumps",
    "",
    [
        (PF_STRING, "folder", "Input directory", "/Users/agnomen/Documents/workspace/git/ponderous-mad/appengine/blitblort/images/dragon"),
        (PF_STRING, "batchRoot", "Batcher root", "/Users/agnomen/Documents/workspace/git/ponderous-mad/appengine/blitblort/images/"),
        (PF_INT, "width", "Width of region to capture", "200"),
        (PF_INT, "top", "Top of region to capture", "100"),
        (PF_INT, "bottom", "Bottom of region to capture", "300"),
        (PF_FLOAT, "pixelSize", "Pixel Size in meters", "0.001"),
        (PF_FLOAT, "depthRange", "Depth Range in meters", "0.2")
    ],
    [],
    process_blumps)

main()

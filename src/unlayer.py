
image = gimp.image_list()[0]
height = image.height
pdb.gimp_image_resize(image, image.width, height * 2, 0, 0)
pdb.gimp_layer_translate(image.layers[1], 0, height)
 
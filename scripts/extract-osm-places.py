import json
import sys

import osmium

KEYS = ("shop", "amenity", "leisure", "healthcare", "office", "craft", "historic", "tourism")

def wanted(tags):
    return "name" in tags and any(key in tags for key in KEYS)

def kept_tags(tags):
    return {key: tags[key] for key in ("name", *KEYS) if key in tags}

class Ways(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ways = []
        self.needed = set()

    def way(self, way):
        if not wanted(way.tags):
            return
        refs = [node.ref for node in way.nodes]
        if len(refs) > 1 and refs[0] == refs[-1]:
            refs = refs[:-1]
        self.ways.append((way.id, refs, kept_tags(way.tags)))
        self.needed.update(refs)

class Nodes(osmium.SimpleHandler):
    def __init__(self, needed):
        super().__init__()
        self.needed = needed
        self.at = {}
        self.places = []

    def node(self, node):
        if not node.location.valid():
            return
        if node.id in self.needed:
            self.at[node.id] = (node.location.lat, node.location.lon)
        if wanted(node.tags):
            self.places.append({"type": "node", "id": node.id, "lat": node.location.lat, "lon": node.location.lon, "tags": kept_tags(node.tags)})

def main(source, target):
    ways = Ways()
    ways.apply_file(source)
    nodes = Nodes(ways.needed)
    nodes.apply_file(source)
    elements = nodes.places
    for way_id, refs, tags in ways.ways:
        points = [nodes.at[ref] for ref in refs if ref in nodes.at]
        if not points:
            continue
        lat = sum(point[0] for point in points) / len(points)
        lon = sum(point[1] for point in points) / len(points)
        elements.append({"type": "way", "id": way_id, "center": {"lat": lat, "lon": lon}, "tags": tags})
    with open(target, "w", encoding="utf-8") as out:
        json.dump(elements, out, ensure_ascii=False)
    print("Places read:", len(elements), "nodes", len(nodes.places), "ways", len(ways.ways))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

import sys
from PIL import Image
G="""
........##
..########
.#########
.########.
..........
..######..
.#######..
..........
.###......
##........
""".strip().split("\n")
h=len(G);w=len(G[0]);assert all(len(r)==w for r in G)
N=int(sys.argv[1]);S=int(sys.argv[2])
px=[(x+.5,y+.5) for y,r in enumerate(G) for x,c in enumerate(r) if c=="#"]
cx=sum(p[0] for p in px)/len(px);cy=sum(p[1] for p in px)/len(px)
print("size",w,h,"cells",len(px),"centroid local",round(cx,2),round(cy,2))
best=None
for oy in range(0,N-h+1):
  for ox in range(0,N-w+1):
    bb=(ox+w/2-N/2, oy+h/2-N/2)       # outline center error
    ce=(ox+cx-N/2, oy+cy-N/2)          # mass center error
    err=max(abs(bb[0]),abs(ce[0]))**2+max(abs(bb[1]),abs(ce[1]))**2
    # minimax: balance both
    if best is None or err<best[0]: best=(err,ox,oy,bb,ce)
print(best)
_,ox,oy,_,_=best
im=Image.new("RGB",(N*S,N*S),(14,25,57))
for y,r in enumerate(G):
  for x,c in enumerate(r):
    if c=="#": im.paste((245,245,240),((ox+x)*S,(oy+y)*S,(ox+x+1)*S,(oy+y+1)*S))
im.save(sys.argv[3])

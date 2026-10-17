from pathlib import Path
import subprocess,json,datetime,sys
if len(sys.argv)!=3: raise SystemExit('Usage: python scripts/evidence-highlights.py EXTRACTED_ARTIFACT_FOLDERS OUTPUT_FOLDER')
raw=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);edits=[]
for folder in sorted(raw.iterdir()):
 movies=list(folder.glob('*.webm'))
 if not movies:continue
 src=movies[0];name=folder.name;dest=out/name/'highlights.webm'
 probe=subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(src)],text=True);duration=float(json.loads(probe)['format']['duration'])
 if name=='animation':
  starts=[(0,min(duration,40))]
 else:
  lines=(folder/'progress.log').read_text().splitlines();first=next(x for x in lines if 'PROGRESS' in x).split(' ')[0];last=next(x for x in reversed(lines) if 'PASS' in x).split(' ')[0]
  begin=datetime.datetime.fromisoformat(first.replace('Z','+00:00'));end=datetime.datetime.fromisoformat(last.replace('Z','+00:00'))
  game=max(4,duration-(end-begin).total_seconds()-2)
  starts=[(1,4),(min(max(4,game),duration-15),5),(max(5,(game+duration-8)/2),4),(max(0,duration-5),5)]
 args=['ffmpeg','-y','-v','error','-threads','1']
 for start,length in starts:args+=['-ss',str(round(start,3)),'-t',str(round(length,3)),'-i',str(src)]
 width=360 if name.startswith('mobile') else 960
 filters=[]
 for i in range(len(starts)):filters.append(f'[{i}:v]scale={width}:-2,fps=20,setsar=1,setpts=PTS-STARTPTS[v{i}]')
 filters.append(''.join(f'[v{i}]' for i in range(len(starts)))+f'concat=n={len(starts)}:v=1:a=0[out]')
 args+=['-filter_complex',';'.join(filters),'-map','[out]','-an','-c:v','libvpx-vp9','-crf','34','-b:v','0','-cpu-used','6','-deadline','realtime','-threads','1',str(dest)]
 subprocess.run(args,check=True)
 edits.append({'case':name,'originalVideo':src.name,'originalDuration':duration,'segments':[{'start':round(a,3),'seconds':round(b,3)} for a,b in starts],'output':'highlights.webm','note':'Time-edited original screen recording; full continuous play retained in linked Actions artifact.'})
 print(name,round(duration,1),'->',sum(b for a,b in starts),dest.stat().st_size,flush=True)
(out/'clip-edits.json').write_text(json.dumps(edits,indent=2))

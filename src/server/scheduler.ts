import type {SqliteRepository} from './sqlite-repository';
import type {ProbeRunner} from '../application/probe-runner';
import type {ProbeSchedule} from '../core/contracts';

function nextRunAt(cadence:ProbeSchedule['cadence'],from=new Date()):string {
    const d=new Date(from);
    if(cadence==='daily')d.setDate(d.getDate()+1);
    else if(cadence==='weekly')d.setDate(d.getDate()+7);
    else d.setMonth(d.getMonth()+1);
    return d.toISOString();
}

export class Scheduler {
    private timer:NodeJS.Timeout|null=null;
    constructor(private repo:SqliteRepository,private runner:ProbeRunner){}
    start(intervalMs=5*60*1000){
        this.timer=setInterval(()=>this.tick(),intervalMs);
        this.timer.unref();
    }
    stop(){if(this.timer){clearInterval(this.timer);this.timer=null;}}
    async tick(){
        let due:ProbeSchedule[];
        try{due=this.repo.listDueSchedules();}catch{return;}
        for(const sched of due){
            try{
                const client=await this.repo.getClient(sched.owner,sched.clientId);
                if(!client)continue;
                const run=await this.runner.runProbes(client,sched.prompts,sched.providers);
                await this.repo.saveProbeRun(sched.owner,sched.clientId,run);
                const now=new Date().toISOString();
                this.repo.updateScheduleRun(sched.id,now,nextRunAt(sched.cadence));
            }catch{/* log silently; don't abort other schedules */}
        }
    }
}

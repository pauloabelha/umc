"""Continuous motor poses evaluated on CUDA; never drives marble bodies."""
import warp as wp

@wp.kernel
def rotate_motors(indices: wp.array(dtype=int), positions: wp.array(dtype=wp.vec3), bases: wp.array(dtype=wp.quat),
                  speeds: wp.array(dtype=float), time: float, q: wp.array(dtype=wp.transform), qd: wp.array(dtype=wp.spatial_vector)):
    i=wp.tid()
    rotation=bases[i]*wp.quat_from_axis_angle(wp.vec3(0.0,0.0,1.0),speeds[i]*time)
    angular=wp.quat_rotate(bases[i],wp.vec3(0.0,0.0,speeds[i]))
    q[indices[i]]=wp.transform(positions[i],rotation)
    qd[indices[i]]=wp.spatial_vector(0.0,0.0,0.0,angular[0],angular[1],angular[2])

class MotorDrives:
    def __init__(self, warp, device, driven):
        self.device,self.count=device,len(driven)
        self.indices=wp.array([i for i,_ in driven],dtype=int,device=device)
        self.positions=wp.array([drive['position'] for _,drive in driven],dtype=wp.vec3,device=device)
        self.bases=wp.array([drive['rotation'] for _,drive in driven],dtype=wp.quat,device=device)
        self.speeds=wp.array([drive['angularSpeed'] for _,drive in driven],dtype=float,device=device)
    def apply(self,state,time,dt):
        wp.launch(rotate_motors,dim=self.count,inputs=[self.indices,self.positions,self.bases,self.speeds,time,state.body_q,state.body_qd],device=self.device)

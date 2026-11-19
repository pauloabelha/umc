import copy
import unittest
from physics import validate
from server import Service

SCENE = dict(format='umc-scene', version=1, timestep=1/240, gravity=[0, -9.81, 0], bodies=[
    dict(id='marble', motion='dynamic', shape=dict(kind='sphere', radius=.011),
         mass=.005, position=[0, 0, 0], rotation=[0, 0, 0, 1], friction=.3, restitution=.02)])


class ValidationTests(unittest.TestCase):
    def test_valid_scene(self):
        self.assertIs(validate(SCENE), SCENE)

    def test_rejects_bad_geometry_and_unsupported_shapes(self):
        for field, value in [('mass', 0), ('rotation', [0, 0, 0, 0]), ('position', [float('nan'), 0, 0]),
                             ('shape', dict(kind='box', size=[1, 1, 1]))]:
            scene = copy.deepcopy(SCENE)
            scene['bodies'][0][field] = value
            with self.assertRaises(ValueError):
                validate(scene)

    def test_rejects_duplicate_ids(self):
        scene = copy.deepcopy(SCENE)
        scene['bodies'] *= 2
        with self.assertRaises(ValueError):
            validate(scene)

    def test_rejects_stale_step_without_advancing(self):
        class World:
            ticks = 4
            def step(self):
                raise AssertionError('must not step')
        service = Service()
        service.worlds['x'] = (World(), 0)
        with self.assertRaises(ValueError):
            service.handle('POST', ['worlds', 'x', 'step'], dict(steps=4, expectedTicks=0))
        service.expire()
        # Requests touch the lease, keeping this active world alive.
        self.assertIn('x', service.worlds)
        service.worlds['x'] = (World(), 0)
        service.expire()
        self.assertNotIn('x', service.worlds)

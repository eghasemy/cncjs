import fs from 'fs';
import path from 'path';
import settings from '../config/settings';
import config from '../services/configstore';
import { ERR_BAD_REQUEST, ERR_NOT_FOUND, ERR_INTERNAL_SERVER_ERROR } from '../constants';

const dir = path.resolve(settings.fluidnc.dir);
const ACTIVE_KEY = 'fluidnc.activeConfig';

export const list = (req, res) => {
  try {
    const files = fs.readdirSync(dir);
    const active = config.get(ACTIVE_KEY, '');
    res.send({ files, active });
  } catch (err) {
    res.status(ERR_INTERNAL_SERVER_ERROR).send({ msg: 'Failed to list files' });
  }
};

export const upload = (req, res) => {
  const { name, data } = { ...req.body };
  if (!name || data == null) {
    res.status(ERR_BAD_REQUEST).send({ msg: 'Missing data' });
    return;
  }
  try {
    fs.writeFileSync(path.join(dir, name), data, 'utf8');
    res.send({ err: null });
  } catch (err) {
    res.status(ERR_INTERNAL_SERVER_ERROR).send({ msg: 'Failed to save file' });
  }
};

export const remove = (req, res) => {
  const name = req.params.name;
  const active = config.get(ACTIVE_KEY, '');
  if (name === active) {
    res.status(ERR_BAD_REQUEST).send({ msg: 'Cannot delete active config' });
    return;
  }
  try {
    fs.unlinkSync(path.join(dir, name));
    res.send({ err: null });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(ERR_NOT_FOUND).send({ msg: 'File not found' });
    } else {
      res.status(ERR_INTERNAL_SERVER_ERROR).send({ msg: 'Failed to delete file' });
    }
  }
};

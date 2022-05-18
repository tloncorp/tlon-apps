import React, { ChangeEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import { Link } from 'react-router-dom';

interface FormSchema {
  ship: string;
}

export default function NewDM() {
  const [ship, setShip] = useState('');
  const navigate = useNavigate();
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setShip(e.currentTarget.value);
  };
  const validShip = ob.isValidPatp(ship);

  return (
    <div className="flex flex-col">
      <input
        className="rounded border"
        type="text"
        value={ship}
        onChange={onChange}
      />
      <Link aria-disabled={!validShip} to={`/dm/${ship}`}>
        New DM
      </Link>
    </div>
  );
}

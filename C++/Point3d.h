# pragma once

class Vector;

class Point{
    private:
        double m_x{};
        double m_y{};
        double m_z{};
    
    public:
        Point(double x, double y, double z);

        void print() const; /* const function paramter forbid/protects the args parameter passed in while the object itself remain mutable,
                            trailing const protexts the object itself, meaning its immutable and is the caller is permitted to view access only*/ 
        void moveByVector(const Vector& v);
};

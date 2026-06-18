# pragma once
#include "Point3d.h" // for declaring Point3d::moveByVector() as a friend

class Vector{
    private:
        double m_x{};
        double m_y{};
        double m_z{};
    
    public:
        Vector(double x, double y, double z);

        void print() const;

        friend void Point::moveByVector(const Vector& v);
};

